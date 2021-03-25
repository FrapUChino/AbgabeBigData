What this application is about 
============================
Our application contains a list of various bestselling books, as well as information about their authors, ratings and some other features. The data set used for this comes from kaggle.com.

The data is output in a table, which enables further information to be displayed by clicking on the title of a respective book. When you call up a book for the first time, it is not temporarily stored in the cache: the value "false" is displayed. The next time it is called, the value changes to "true".

Just like in the use case, 10 books can be fetched by clicking on "Randomly fetch some books".
Depending on the frequency with which a book is called up, a diagram is displayed showing the ID of the book and how often it was called.
You can also display and visualize the top authors here. "Top authors" are those, whose books are the most clicked ones(f.e. clicking all the Harry Patter Books leads to a hjgh score of J.K. Rowling).


Install k3s on OpenStack
============================

Requirements
------------

-	[Terraform](https://www.terraform.io/downloads.html) 0.12.x
-	[Ansible](https://www.ansible.com)


Apply the cluster
------------

Set all relevant variables i.e. password, login, names

AppOnOpenStack/k3s.tf:

```yaml
 user_name = "someLogin"
        password = "somePW"
        auth_url = "http://xyz/v3"
        domain_name = "default"
        tenant_id = "1eee05cb3a2c4ayf9b93d79359e2r471 "
}

```

```bash
export ANSIBLE_HOST_KEY_CHECKING=false
terraform apply
ansible-playbook -i hosts deploy.yaml
```

**Thats all to deploy the cluster.**



Work locally with remote cluster
------------

on remote:

```bash
sudo chmod 777 /etc/rancher/k3s/k3s.yaml
```

local:

Copy k3s.yaml from server:

```bash
scp  ubuntu@MASTER_IP:/etc/rancher/k3s/k3s.yaml .
```

```yaml
- cluster:
    insecure-skip-tls-verify: true
    certificate-authority-data: myCertificate
    server: https://myIP:6443
  name: default
```


```sh
export KUBECONFIG=MyPathTo/k3s.yaml
```

Prerequisites
------------

A running Strimzi.io Kafka operator

```bash
helm repo add strimzi http://strimzi.io/charts/
helm install my-kafka-operator strimzi/strimzi-kafka-operator
kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml
```

A running Hadoop cluster with YARN (for checkpointing)

```bash
helm repo add stable https://charts.helm.sh/stable
helm install --namespace=default --set hdfs.dataNode.replicas=3 --set yarn.nodeManager.replicas=3 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
```

Develop:

```bash
change default repo: skaffold config set --global default-repo <myrepo>
skaffold dev
```
