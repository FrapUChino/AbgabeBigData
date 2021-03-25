terraform {
  required_providers {
    openstack = {
      source = "terraform-provider-openstack/openstack"
    }
  }
}

provider "openstack" {
        user_name = "pfisterer-hb20"
        password = "hb-cloud"
        auth_url = "http://controller.4c.dhbw-mannheim.de:5000/v3"
        domain_name = "default"
        tenant_id = "1eee05cb3a2c4a3f9b93d79359e20471"
}

resource "openstack_compute_instance_v2" "abgabe_k3s_master" {
  name = "abgabe_k3s_master"
  image_id = "a0a1c616-f4f3-429d-8de9-8e74b5df805c"
  flavor_name = "m1.large"
  security_groups = ["default"]
  key_pair = "LukasRSA"

  network {
          name = "lukas_network"
  }
}


resource "openstack_compute_instance_v2" "abgabe_k3s_nodes" {
  count=3
  name= format("abgabe_k3s_node_%s", count.index)
  image_id = "a0a1c616-f4f3-429d-8de9-8e74b5df805c"
  flavor_name = "m1.large"
  security_groups = ["default"]
  key_pair = "LukasRSA"

  network {
          name = "lukas_network"
  }
}

resource "openstack_networking_floatingip_v2" "abgabe_floating_node_ip" {
        count=3
        pool ="ext-net-201"
}

resource "openstack_compute_floatingip_associate_v2" "associate_node_ips" {
        count = length(openstack_compute_instance_v2.abgabe_k3s_nodes)
        floating_ip = "${openstack_networking_floatingip_v2.abgabe_floating_node_ip[count.index].address}"
        instance_id = openstack_compute_instance_v2.abgabe_k3s_nodes[count.index].id
}

resource "openstack_networking_floatingip_v2" "abgabe_floating_ip" {
        pool ="ext-net-201"
}

resource "openstack_compute_floatingip_associate_v2" "associate" {
        floating_ip = openstack_networking_floatingip_v2.abgabe_floating_ip.address
        instance_id = openstack_compute_instance_v2.abgabe_k3s_master.id
}



#Write Floating IP to file
data "template_file" "ansible_inventory" {
  template = "${file("${path.module}/hosts.tmpl")}"

  vars = {
     master_pub_ip = "${openstack_networking_floatingip_v2.abgabe_floating_ip.address}"
     node_pub_ips = "${join("\n",openstack_networking_floatingip_v2.abgabe_floating_node_ip.*.address)}"
  }
}

resource "local_file" "hosts" {
  filename = "${path.module}/hosts"
  content = data.template_file.ansible_inventory.rendered
}


resource "local_file" "floating_id_file" {
        content = openstack_networking_floatingip_v2.abgabe_floating_ip.address
        filename = "${path.module}/openstack-inventory.txt"
}
