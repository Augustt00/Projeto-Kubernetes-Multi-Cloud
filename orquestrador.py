import os
import subprocess
import argparse
import sys
import time
import urllib.request
import urllib.parse
import urllib.error
import json

# === COLOQUE OS SEUS DADOS DO GITLAB AQUI ===
GITLAB_PROJECT_ID = "****"
GITLAB_TRIGGER_TOKEN = "******" 
GITLAB_API_TOKEN = "g*****"
# ============================================

def executar_comando(comando, diretorio):
    cmd_str = ' '.join(comando) if isinstance(comando, list) else comando
    print(f"\n🚀 Executando: {cmd_str} na pasta '{diretorio}'...")
    try:
        processo = subprocess.Popen(
            comando, cwd=diretorio, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, encoding='utf-8', shell=False
        )
        for linha in processo.stdout:
            print(linha, end="")
        processo.wait()
        
        if processo.returncode != 0:
            print(f"\n❌ Erro ao executar o comando. Código de saída: {processo.returncode}")
            sys.exit(1)
    except Exception as e:
        print(f"\n❌ Ocorreu um erro inesperado no Python: {e}")
        sys.exit(1)

def atualizar_memoria_gitlab(valor):
    """ Altera o valor da variável CLOUD_ALVO lá nas configurações do GitLab """
    print(f"\n🧠 Atualizando a memória do GitLab: A nuvem ativa agora é '{valor.upper()}'...")
    url = f"https://gitlab.com/api/v4/projects/{GITLAB_PROJECT_ID}/variables/CLOUD_ALVO"
    
    dados = urllib.parse.urlencode({'value': valor}).encode('utf-8')
    headers = {'PRIVATE-TOKEN': GITLAB_API_TOKEN}
    
    try:
        req = urllib.request.Request(url, data=dados, headers=headers, method='PUT')
        with urllib.request.urlopen(req) as resposta:
            print(" Memória atualizada! Seus próximos 'git push' serão 100% automáticos.")
    except urllib.error.HTTPError as e:
        print(f"⚠️ Aviso: Não consegui atualizar a memória no GitLab (Erro {e.code}). Verifique seu GITLAB_API_TOKEN.")

def acionar_pipeline(nuvem):
    print(f"\n Chamando a API do GitLab para iniciar o deploy automatizado na {nuvem.upper()}...")
    url = f"https://gitlab.com/api/v4/projects/{GITLAB_PROJECT_ID}/trigger/pipeline"
    dados = urllib.parse.urlencode({'token': GITLAB_TRIGGER_TOKEN, 'ref': 'main', 'variables[CLOUD_ALVO]': nuvem}).encode('utf-8')
    try:
        req = urllib.request.Request(url, data=dados, method='POST')
        with urllib.request.urlopen(req) as resposta:
            resultado = json.loads(resposta.read().decode('utf-8'))
            print(f"✅ Pipeline criada com sucesso! 🔗 Link: {resultado.get('web_url')}")
    except urllib.error.HTTPError as e:
        print(f"\n❌ O GitLab bloqueou o gatilho! Erro: {e.read().decode('utf-8')}")

def buscar_ip_externo(nuvem, pasta_terraform):
    print(f"\n🔍 Conectando ao cluster da {nuvem.upper()} para buscar o endereço de acesso...")
    try:
        processo_output = subprocess.run('terraform output -raw comando_para_conectar', cwd=pasta_terraform, capture_output=True, text=True, shell=True)
        comando_conexao = processo_output.stdout.strip()
        if not comando_conexao:
            return
            
        subprocess.run(comando_conexao, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, shell=True)
        print("⏳ Aguardando a nuvem provisionar o IP Público (isso leva uns 30 segundos)...")
        time.sleep(30)
        
        print("\n🌐 === ENDEREÇO DO SEU E-COMMERCE ===")
        subprocess.run('kubectl get svc -n ingress-nginx', shell=True)
        print("=====================================\n")
    except Exception as e:
        print("⚠️ Não foi possível buscar o IP automaticamente.")

def main():
    parser = argparse.ArgumentParser(description="Orquestrador Multi-Cloud do E-commerce ☁️")
    parser.add_argument('--nuvem', choices=['aws', 'azure', 'gcp'], required=True, help="Qual nuvem você quer usar?")
    parser.add_argument('--acao', choices=['deploy', 'destroy'], required=True, help="Criar (deploy) ou destruir (destroy)?")
    args = parser.parse_args()
    
    pasta_terraform = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'terraform', args.nuvem)
    
    if not os.path.exists(pasta_terraform):
        print(f"❌ Erro: A pasta {pasta_terraform} não existe!")
        sys.exit(1)

    executar_comando(['terraform', 'init'], pasta_terraform)
    
    if args.acao == 'deploy':
        executar_comando(['terraform', 'apply', '-auto-approve'], pasta_terraform)
        print(f"\n✅ Infraestrutura base na {args.nuvem.upper()} criada com sucesso!")
        
        atualizar_memoria_gitlab(args.nuvem) 
        acionar_pipeline(args.nuvem)
        buscar_ip_externo(args.nuvem, pasta_terraform)
        
    elif args.acao == 'destroy':
        executar_comando(['terraform', 'destroy', '-auto-approve'], pasta_terraform)
        print(f"\n✅ Ambiente destruído com sucesso!")
        
        # Limpa a memória do GitLab para evitar acidentes no próximo push
        atualizar_memoria_gitlab('aguardando')

if __name__ == "__main__":
    main()