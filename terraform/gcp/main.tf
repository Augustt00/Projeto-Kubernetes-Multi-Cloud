# ==========================================
# 1. PROVEDOR GOOGLE CLOUD
# ==========================================
provider "google" {
  project = "******" # Substitua pelo seu Project ID real
  region  = "us-central1"
}

# ==========================================
# 2. CRIAÇÃO DO CLUSTER GKE
# ==========================================
resource "google_container_cluster" "meu_cluster_devops" {
  name     = "cluster-devops"
  location = "us-central1-c"

  deletion_protection = false # Permite destruir o cluster depois com o Terraform
  initial_node_count  = 2

  node_config {
    machine_type = "e2-medium"
    disk_type    = "pd-standard" 
    disk_size_gb = 50            

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]
  }
}

# ==========================================
# 3. PROVEDOR KUBERNETES E CREDENCIAIS GKE
# ==========================================
data "google_client_config" "default" {}

provider "kubernetes" {
  host                   = "https://${google_container_cluster.meu_cluster_devops.endpoint}"
  token                  = data.google_client_config.default.access_token
  cluster_ca_certificate = base64decode(google_container_cluster.meu_cluster_devops.master_auth[0].cluster_ca_certificate)
}

# Cria o Namespace "ecommerce" (Atualizado para v1)
resource "kubernetes_namespace_v1" "ecommerce" {
  metadata {
    name = "ecommerce"
  }
}

# Cria o Secret do GitLab para baixar as imagens (Atualizado para v1)
resource "kubernetes_secret_v1" "gitlab_registry" {
  metadata {
    name      = "gitlab-registry"
    namespace = kubernetes_namespace_v1.ecommerce.metadata[0].name 
  }

  type = "kubernetes.io/dockerconfigjson"

  data = {
    ".dockerconfigjson" = jsonencode({
      auths = {
        "registry.gitlab.com" = {
          username = "*****"
          password = "*******"
          email    = "*****"
          auth     = base64encode("****:****")
        }
      }
    })
  }
}

# ==========================================
# 4. PROVEDOR HELM E INGRESS NGINX
# ==========================================
provider "helm" {
  kubernetes = {
    host                   = "https://${google_container_cluster.meu_cluster_devops.endpoint}"
    token                  = data.google_client_config.default.access_token
    cluster_ca_certificate = base64decode(google_container_cluster.meu_cluster_devops.master_auth[0].cluster_ca_certificate)
  }
}

# Instala o Ingress Nginx via Helm
resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  namespace        = "ingress-nginx"
  create_namespace = true 

  set = [{
    name  = "controller.service.type"
    value = "LoadBalancer"
  }]
}

# ==========================================
# 5. OUTPUTS (SAÍDAS NO TERMINAL)
# ==========================================
output "comando_para_conectar" {
  value       = "gcloud container clusters get-credentials ${google_container_cluster.meu_cluster_devops.name} --zone ${google_container_cluster.meu_cluster_devops.location}"
  description = "Rode este comando no terminal para configurar o seu kubectl localmente"
}