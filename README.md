☁️ Multi-Cloud E-commerce Orquestrator & Microservices

![Status](https://img.shields.io/badge/Status-Concluído-success)
![AWS](https://img.shields.io/badge/AWS-EKS-FF9900?logo=amazonaws)
![Azure](https://img.shields.io/badge/Azure-AKS-0089D6?logo=microsoftazure)
![GCP](https://img.shields.io/badge/GCP-GKE-4285F4?logo=googlecloud)
![Python](https://img.shields.io/badge/Python-CLI_Orchestrator-3776AB?logo=python)
![GitLab](https://img.shields.io/badge/GitLab-CI%2FCD-FC6D26?logo=gitlab)

🎯 Sobre o Projeto

Este projeto é uma prova de conceito (PoC) de uma arquitetura de **Microserviços** altamente escalável, projetada para ser completamente agnóstica de nuvem (Multi-Cloud). 

A infraestrutura é provisionada via **Terraform**, enquanto um orquestrador customizado em **Python** gerencia automaticamente a criação dos clusters, a injeção de variáveis de estado na API do GitLab e o acionamento de esteiras **Event-Driven CI/CD**.

## 🚀 Arquitetura e Fluxo de CI/CD

1. **Orquestração Inteligente:** O script Python local invoca o Terraform para subir o cluster na nuvem escolhida (AWS, Azure ou GCP).
2. **Event-Driven API:** Após o provisionamento, o Python atualiza dinamicamente a memória do repositório via GitLab API e aciona o gatilho da pipeline.
3. **Build & Push:** O GitLab CI constrói as imagens Docker dos 5 microsserviços (Frontend, Gateway, Catalog, Cart, Order) e as envia para o Container Registry.
4. **Deploy contínuo:** O Helm aplica os manifestos Kubernetes automaticamente no cluster ativo. Atualizações no código (`git push`) realizam deploy automático lendo a variável de estado da nuvem.

<p align="center">
  <img src="docs/ci-cd-flow.png" width="900">
</p>

## 🔒 DevSecOps & 💰 FinOps (Diferenciais)
* **FinOps (Infracost):** Integrado ao orquestrador Python para calcular a estimativa de custos da infraestrutura *antes* do deploy, evitando surpresas no faturamento.
* **DevSecOps (Trivy):** Análise de vulnerabilidades (CVEs) em contêineres acoplada à esteira de CI/CD, bloqueando o deploy de imagens críticas.

## 🛠️ Como Executar o Orquestrador
O projeto possui uma CLI própria desenvolvida em Python para facilitar a operação de infraestrutura.

```bash
# Para realizar o deploy em uma nuvem específica (aws, azure ou gcp):
python orquestrador.py --nuvem gcp --acao deploy

# Para destruir o ambiente e evitar custos:

python orquestrador.py --nuvem gcp --acao destroy


