terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0" # Travando na versão 3 para estabilidade
    }
  }
}

# ==========================================
# 1. PROVEDOR AZURE
# ==========================================
provider "azurerm" {
  features {} # A Azure exige esse bloco vazio por padrão
}

# ==========================================
# 2. RESOURCE GROUP (A "pasta" do projeto)
# ==========================================
resource "azurerm_resource_group" "rg" {
  name     = "ecommerce-rg"
  location = "East US"
}

# ==========================================
# 3. CRIAÇÃO DO CLUSTER AKS (KUBERNETES)
# ==========================================
resource "azurerm_kubernetes_cluster" "aks" {
  name                = "cluster-devops-azure"
  location            = azurerm_resource_group.rg.location
  resource_group_name = azurerm_resource_group.rg.name
  dns_prefix          = "ecommerce-aks"

  default_node_pool {
    name       = "default"
    node_count = 2
    vm_size    = "Standard_DC2as_v5" 
  }

  identity {
    type = "SystemAssigned" # A Azure cria as credenciais de segurança automaticamente
  }
}

# ==========================================
# 4. PROVEDOR KUBERNETES E CREDENCIAIS
# ==========================================
provider "kubernetes" {
  host                   = azurerm_kubernetes_cluster.aks.kube_config.0.host
  client_certificate     = base64decode(azurerm_kubernetes_cluster.aks.kube_config.0.client_certificate)
  client_key             = base64decode(azurerm_kubernetes_cluster.aks.kube_config.0.client_key)
  cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.aks.kube_config.0.cluster_ca_certificate)
}

# Cria o Namespace
resource "kubernetes_namespace_v1" "ecommerce" {
  metadata {
    name = "ecommerce"
  }
  depends_on = [azurerm_kubernetes_cluster.aks]
}

# Cria o Secret do GitLab
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
          username = "****"
          password = "g*****"
          email    = "*******"
          auth     = base64encode("******:********")
        }
      }
    })
  }
  depends_on = [azurerm_kubernetes_cluster.aks]
}

# ==========================================
# 5. PROVEDOR HELM E INGRESS NGINX
# ==========================================
provider "helm" {
  kubernetes = { 
    host                   = azurerm_kubernetes_cluster.aks.kube_config.0.host
    client_certificate     = base64decode(azurerm_kubernetes_cluster.aks.kube_config.0.client_certificate)
    client_key             = base64decode(azurerm_kubernetes_cluster.aks.kube_config.0.client_key)
    cluster_ca_certificate = base64decode(azurerm_kubernetes_cluster.aks.kube_config.0.cluster_ca_certificate)
  }
}

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

  depends_on = [azurerm_kubernetes_cluster.aks]
}

# ==========================================
# 6. OUTPUT (COMANDO PARA CONECTAR NO TERMINAL)
# ==========================================
output "comando_para_conectar" {
  value       = "az aks get-credentials --resource-group ${azurerm_resource_group.rg.name} --name ${azurerm_kubernetes_cluster.aks.name}"
  description = "Rode este comando no terminal para conectar o seu kubectl à Azure"
}