const os = require('os')
const dns = require('dns').promises
const { program: optionparser } = require('commander')
const { Kafka } = require('kafkajs')
const mysqlx = require('@mysql/xdevapi');
const MemcachePlus = require('memcache-plus');
const express = require('express')

const app = express()
const cacheTimeSecs = 15
const numberOfBooks = 140

// -------------------------------------------------------
// Command-line options
// -------------------------------------------------------

let options = optionparser
	.storeOptionsAsProperties(true)
	// Web server
	.option('--port <port>', "Web server port", 3000)
	// Kafka options
	.option('--kafka-broker <host:port>', "Kafka bootstrap host:port", "my-cluster-kafka-bootstrap:9092")
	.option('--kafka-topic-tracking <topic>', "Kafka topic to tracking data send to", "tracking-data")
	.option('--kafka-client-id < id > ', "Kafka client ID", "tracker-" + Math.floor(Math.random() * 100000))
	// Memcached options
	.option('--memcached-hostname <hostname>', 'Memcached hostname (may resolve to multiple IPs)', 'my-memcached-service')
	.option('--memcached-port <port>', 'Memcached port', 11211)
	.option('--memcached-update-interval <ms>', 'Interval to query DNS for memcached IPs', 5000)
	// Database options
	.option('--mysql-host <host>', 'MySQL host', 'my-app-mysql-service')
	.option('--mysql-port <port>', 'MySQL port', 33060)
	.option('--mysql-schema <db>', 'MySQL Schema/database', 'popular')
	.option('--mysql-username <username>', 'MySQL username', 'root')
	.option('--mysql-password <password>', 'MySQL password', 'mysecretpw')
	// Misc
	.addHelpCommand()
	.parse()
	.opts()

// -------------------------------------------------------
// Database Configuration
// -------------------------------------------------------

const dbConfig = {
	host: options.mysqlHost,
	port: options.mysqlPort,
	user: options.mysqlUsername,
	password: options.mysqlPassword,
	schema: options.mysqlSchema
};

async function executeQuery(query, data) {
	let session = await mysqlx.getSession(dbConfig);
	return await session.sql(query, data).bind(data).execute()
}

// -------------------------------------------------------
// Memcache Configuration
// -------------------------------------------------------

//Connect to the memcached instances
let memcached = null
let memcachedServers = []

async function getMemcachedServersFromDns() {
	try {
		// Query all IP addresses for this hostname
		let queryResult = await dns.lookup(options.memcachedHostname, { all: true })

		// Create IP:Port mappings
		let servers = queryResult.map(el => el.address + ":" + options.memcachedPort)

		// Check if the list of servers has changed
		// and only create a new object if the server list has changed
		if (memcachedServers.sort().toString() !== servers.sort().toString()) {
			console.log("Updated memcached server list to ", servers)
			memcachedServers = servers

			//Disconnect an existing client
			if (memcached)
				await memcached.disconnect()

			memcached = new MemcachePlus(memcachedServers);
		}
	} catch (e) {
		console.log("Unable to get memcache servers", e)
	}
}

//Initially try to connect to the memcached servers, then each 5s update the list
getMemcachedServersFromDns()
setInterval(() => getMemcachedServersFromDns(), options.memcachedUpdateInterval)

//Get data from cache if a cache exists yet
async function getFromCache(key) {
	if (!memcached) {
		console.log(`No memcached instance available, memcachedServers = ${memcachedServers}`)
		return null;
	}
	return await memcached.get(key);
}

// -------------------------------------------------------
// Kafka Configuration
// -------------------------------------------------------

// Kafka connection
const kafka = new Kafka({
	clientId: options.kafkaClientId,
	brokers: [options.kafkaBroker],
	retry: {
		retries: 0
	}
})

const producer = kafka.producer()
// End

// Send tracking message to Kafka
async function sendTrackingMessage(data) {
	//Ensure the producer is connected
	await producer.connect()

	//Send message
	await producer.send({
		topic: options.kafkaTopicTracking,
		messages: [
			{ value: JSON.stringify(data) }
		]
	})
}


// End

// -------------------------------------------------------
// HTML helper to send a response to the client
// -------------------------------------------------------

async function sendResponse(res, html, tabelle) {
	res.send(`<!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Big Data App Booklist</title>
			<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/mini.css/3.0.1/mini-default.min.css">
			<script>
			function fetchRandomBooks() {
				const maxRepetitions = 10
				document.getElementById("out").innerText = "Fetching " + maxRepetitions + " random books, see console output"
				for(var i = 0; i < maxRepetitions; ++i) {
					const booksId = Math.floor(Math.random() * ${numberOfBooks})
					console.log("Fetching Book id " + booksId)
					fetch("/books/"+booksId, {cache: 'no-cache'})
				}
			}
		</script>
		</head>
		<body style='background-color:#DCDCDC;'>
			<h1 align='center'><font color='#2f4f4f'><strong>List of Bestseller-Books</strong></font></h1>
			<h3 align='center'><font color='#808080'>by Lukas & Kelly for Cloud & BigData course - the dataset is from kaggle.com</font ></h3>
			<p>
				<a href="javascript: fetchRandomBooks();">Randomly fetch some Books</a>
				<span id="out"></span>
			</p>
			${html}
			<hr>
			<h2><font color='#808080'>Information about the generated page</font></h4>
			${tabelle}
		</body>
	</html>
	`
	)
}
// -------------------------------------------------------
// Start page
// -------------------------------------------------------

// Get list of missions (from cache or db)
async function getAllBooks() {
	// TODO: make caching work

	const key = 'buecher'
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { result: cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)
		let executeResult = await executeQuery("SELECT * FROM buecher;", [])
		let data = executeResult.fetchAll()
		if (data) {
			let result = data.map(row => ({id: row[0], title: row[1], author: row[2], rating: row[3],isbn: row[4],language: row[5],pages: row[6],date: row[7],publisher: row[8]}))
			console.log(`Got result=${result.id}, storing in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { result, cached: false }
		} else {
			throw "No Book data found"
		}
	}
}

// Get popular missions (from db only)
async function getPopular(maxCount) {
	const query = "SELECT book,count FROM popular ORDER BY count DESC LIMIT ?"
	return (await executeQuery(query, [maxCount]))
		.fetchAll()
		.map(row => ({ book: row[0], count: row[1] }))
}

async function getPopularAuthors(maxCount) {
	const query = "SELECT author,count FROM popularAuthors ORDER BY count DESC LIMIT ?"
	return (await executeQuery(query, [maxCount]))
		.fetchAll()
		.map(row => ({ author: row[0], count: row[1] }))
}

function createPopularTableHTML(popularBooks) {
	popularBooksNames= popularBooks
	.map(pop => {
		return pop.book
	})

	popularBooksCounts= popularBooks
	.map(pop => {
		return pop.count
	})

	const html = `
		<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.4/Chart.min.js"></script>
		<canvas id="bookChart"  style="width: 70%; height: 70%;"></canvas>
		<script>
		var ctx = document.getElementById('bookChart').getContext('2d');
		var bookChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: [${popularBooksNames}],
				datasets: [{
					label: 'Popular Books',
					data: [${popularBooksCounts}],
					backgroundColor: [
						'rgba(255, 99, 132, 0.2)',
						'rgba(54, 162, 235, 0.2)',
						'rgba(255, 206, 86, 0.2)',
						'rgba(75, 192, 192, 0.2)',
						'rgba(153, 102, 255, 0.2)',
						'rgba(255, 159, 64, 0.2)',
						'rgba(75, 130, 130, 0.2)',
						'rgba(153, 102, 140, 0.2)',
						'rgba(255, 140, 64, 0.2)'
					],
					borderColor: [
						'rgba(255, 99, 132, 1)',
						'rgba(54, 162, 235, 1)',
						'rgba(255, 206, 86, 1)',
						'rgba(75, 192, 192, 1)',
						'rgba(153, 102, 255, 1)',
						'rgba(255, 159, 64, 1)',
						'rgba(75, 130, 130, 1)',
						'rgba(153, 102, 140, 1)',
						'rgba(255, 140, 64, 1)'
					],
					borderWidth: 1
				}]
			},
			options: {
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero: true,
							stepSize: 1
						}
					}]
				}
			}
		});
		</script>
	`
	return html
}

function createPopularAuthorsHtml(popAuthors) {
	popularAuthorsNames= popAuthors
	.map(pop => {
		return "'"+pop.author.toString()+"'"
	})

	popularAuthorCounts= popAuthors
	.map(pop => {
		return pop.count
	})

	const html = `
	<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.4/Chart.min.js"></script>
		<canvas id="authorsChart" style="width: 70%; height: 70%;"></canvas>
		<script>
		var ctx = document.getElementById('authorsChart').getContext('2d');
		var authorsChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: [${popularAuthorsNames}],
				datasets: [{
					label: 'Popular Authors',
					data: [${popularAuthorCounts}],
					backgroundColor: [
						'rgba(255, 99, 132, 0.2)',
						'rgba(54, 162, 235, 0.2)',
						'rgba(255, 206, 86, 0.2)',
						'rgba(75, 192, 192, 0.2)',
						'rgba(153, 102, 255, 0.2)',
						'rgba(255, 159, 64, 0.2)',
						'rgba(75, 130, 130, 0.2)',
						'rgba(153, 102, 140, 0.2)',
						'rgba(255, 140, 64, 0.2)'
					],
					borderColor: [
						'rgba(255, 99, 132, 1)',
						'rgba(54, 162, 235, 1)',
						'rgba(255, 206, 86, 1)',
						'rgba(75, 192, 192, 1)',
						'rgba(153, 102, 255, 1)',
						'rgba(255, 159, 64, 1)',
						'rgba(75, 130, 130, 1)',
						'rgba(153, 102, 140, 1)',
						'rgba(255, 140, 64, 1)'
					],
					borderWidth: 1
				}]
			},
			options: {
				scales: {
					yAxes: [{
						ticks: {
							beginAtZero: true,
							stepSize: 1
						}
					}]
				}
			}
		});
		</script>
	`
	return html

}

// Return HTML for start page
app.get("/:entity?", (req, res) => {
	Promise.all([getAllBooks(), getPopular(10),getPopularAuthors(10)]).then(values => {
		const entity = req.params.entity
		const books = values[0]
		const popular = values[1]
		const popularAuthors = values[2]

		const popAuthors = popularAuthors
			.map(author => ({author: author.author, views: author.count}))

		popAuthors.forEach(author => console.log(author.author+" "+author.views))

		const popularHtml = popular
			.map(pop => `<li> <a href='books/${pop.book}'>${pop.book}</a> (${pop.count} views) </li>`)
			.join("\n")

			var html;
			if(entity && entity == 'authors') {
				html = `
				<h1>Top Authors</h1>
				<p>
				${createPopularAuthorsHtml(popularAuthors)}
				<p>
				<a href="/">Show most popular books</a>	
				`
			} else {
				html = `
				<h1>Top ${10} Books</h1>
				<p>
				${createPopularTableHTML(popular)}
				<p>
				<a href="/authors">Show popular authors</a>			
				`
			}

			const innerTabelle = books.result
				.map(b => `<tr>
							<td>${b.id}</td>
							<td><a href='books/${b.id}'/>${b.title}</a></td>
							<td>${b.author}</td>
							<td>${b.rating}</td>
							<td>${b.isbn}</td>
							<td>${b.language}</td>
							<td>${b.pages}</td>
							<td>${b.date}</td>
							<td>${b.publisher}</td>
						</tr>`
					)
			
			const tabelle = `
			<table bgcolor='#cd5c5c' align='center' cellpadding='5' cellspacing='5' border='1'>
				<tr bgcolor="#A52A2A">
					<td>Buch ID</td><td>Titel</td><td>Authoren</td><td>Bewertung</td><td>ISBN</td><td>Sprache</td><td>Seitenzahl</td><td>Veroeff. Datum</td><td>Verlag</td>
				</tr>
				${innerTabelle}
			</table>
			`
			sendResponse(res, html, tabelle)
	})
})



// -------------------------------------------------------
// Get a specific mission (from cache or DB)
// -------------------------------------------------------

async function getBook(book) {
	const query = "SELECT * FROM buecher WHERE id = ?"
	const key = book
	let cachedata = await getFromCache(key)

	if (cachedata) {
		console.log(`Cache hit for key=${key}, cachedata = ${cachedata}`)
		return { ...cachedata, cached: true }
	} else {
		console.log(`Cache miss for key=${key}, querying database`)

		let row = (await executeQuery(query, [book])).fetchOne()
		if (row) {
			let result = {id: row[0], title: row[1], author: row[2], rating: row[3],isbn: row[4],language: row[5],pages: row[6],date: row[7],publisher: row[8]}
			console.log(`Got result=${result.id}, storing in cache`)
			if (memcached)
				await memcached.set(key, result, cacheTimeSecs);
			return { ...result, cached: false }
		} else {
			throw "No data found for this Book"
		}
	}
}

app.get("/books/:book", (req, res) => {
	let book = req.params["book"]

	// Send reply to browser
	getBook(book).then(data => {
	// Send the tracking message to Kafka
	sendTrackingMessage({
		id: data.id,
		author: data.author,
		timestamp: Math.floor(new Date() / 1000)
	}).then(() => console.log("Sent to kafka"))
		.catch(e => console.log("Error sending to kafka", e))

		sendResponse(res, `<h1>${data.title}</h1><p>${data.authors}</p>`,
			data.cached
		)
	}).catch(err => {
		sendResponse(res, `<h1>Error</h1><p>${err}</p>`, false)
	})
});

// -------------------------------------------------------
// Main method
// -------------------------------------------------------

app.listen(options.port, function () {
	console.log("Node app is running at http://localhost:" + options.port)
});