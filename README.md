Install k3s on OpenStack
============================


Requirements
------------

-	[Terraform](https://www.terraform.io/downloads.html) 0.12.x
-	[Ansible](https://www.ansible.com)


```

Apply the whole thing
---------------------------

fürs erste:

- var-Namen wie Passwort, Login, Netzwerk etc. ersetzen
- export ANSIBLE_HOST_KEY_CHECKING=false
```bash
terraform apply
ansible-playbook -i hosts deploy.yaml
```

--> deployed k3s cluster, aber nicht die App

set kubectl to remote
on remote:

```bash
sudo chmod 777 /etc/rancher/k3s/k3s.yaml
```

local:

Copy k3s.yaml from server:

```bash
scp  ubuntu@MASTER_IP:/etc/rancher/k3s/k3s.yaml .
```

 "change ip to floatingIp" inside local copy of k3s.yaml"
 add" insecure-skip-tls-verify: true" inside k3s.yaml
 
export Variable KUBECONFIG:

```sh
export KUBECONFIG=/Users/lukas/Documents/Hochschule/S7/BigData/PfisterersAppOnOpenStack/k3s.yaml
```

## Prerequisites

A running Strimzi.io Kafka operator

```bash
helm repo add strimzi http://strimzi.io/charts/
helm install my-kafka-operator strimzi/strimzi-kafka-operator
kubectl apply -f https://farberg.de/talks/big-data/code/helm-kafka-operator/kafka-cluster-def.yaml
```

A running Hadoop cluster with YARN (for checkpointing)

```bash
helm repo add stable https://charts.helm.sh/stable
helm install --namespace=default --set hdfs.dataNode.replicas=1 --set yarn.nodeManager.replicas=1 --set hdfs.webhdfs.enabled=true my-hadoop-cluster stable/hadoop
```

Skaffold: 

```bash
change default repo: skaffold config set --global default-repo <myrepo>

```


