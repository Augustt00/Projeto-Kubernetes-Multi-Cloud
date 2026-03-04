terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# ==========================================
# 1. PROVEDOR AWS
# ==========================================
provider "aws" {
  region = "us-east-1"
}

# ==========================================
# 2. REDE (VPC E SUBNETS)
# ==========================================
data "aws_availability_zones" "available" {}

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "5.5.1"

  name                 = "ecommerce-vpc"
  cidr                 = "10.0.0.0/16"
  azs                  = slice(data.aws_availability_zones.available.names, 0, 2)
  public_subnets       = ["10.0.1.0/24", "10.0.2.0/24"]
  enable_dns_hostnames = true
  map_public_ip_on_launch = true

  public_subnet_tags = {
    "kubernetes.io/role/elb" = 1
  }
}

# ==========================================
# 3. CRIAÇÃO DO CLUSTER EKS (KUBERNETES DA AWS)
# ==========================================
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "20.31.0"

  cluster_name    = "cluster-devops-aws"
  cluster_version = "1.30"

  cluster_endpoint_public_access  = true
  vpc_id                          = module.vpc.vpc_id
  subnet_ids                      = module.vpc.public_subnets

  eks_managed_node_groups = {
    nodes = {
      min_size     = 2
      max_size     = 2
      desired_size = 2
      instance_types = ["t3.medium"]
    }
  }

  enable_cluster_creator_admin_permissions = true
}

# ==========================================
# 4. PROVEDOR KUBERNETES E CREDENCIAIS
# ==========================================
provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)

  exec {
    api_version = "client.authentication.k8s.io/v1beta1"
    command     = "aws"
    args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
  }
}

# Cria o Namespace "ecommerce"
resource "kubernetes_namespace_v1" "ecommerce" {
  metadata {
    name = "ecommerce"
  }
  depends_on = [module.eks]
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
          username = "*****"
          password = "g*******"
          email    = "*******"
          auth     = base64encode("******:*******")
        }
      }
    })
  }
  depends_on = [module.eks]
}

# ==========================================
# 5. PROVEDOR HELM E INGRESS NGINX
# ==========================================
provider "helm" {
  kubernetes = {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    
    # Adicionado o sinal de igual no exec
    exec = {
      api_version = "client.authentication.k8s.io/v1beta1"
      command     = "aws"
      args        = ["eks", "get-token", "--cluster-name", module.eks.cluster_name]
    }
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

  depends_on = [module.eks]
}

# ==========================================
# 6. OUTPUTS (SAÍDAS NO TERMINAL)
# ==========================================
output "comando_para_conectar" {
  value       = "aws eks update-kubeconfig --region us-east-1 --name ${module.eks.cluster_name}"
  description = "Rode este comando no terminal para conectar o seu kubectl à AWS"
}