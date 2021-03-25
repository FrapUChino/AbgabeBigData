

Architecture
============================


Install k3s on OpenStack
============================

Requirements
------------

-	[Terraform](https://www.terraform.io/downloads.html)
-	[Ansible](https://www.ansible.com)
-	[Skaffold](https://skaffold.dev/)


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
