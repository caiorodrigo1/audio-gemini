#!/usr/bin/env node

import { WhiskAuthService } from './services/whisk-auth.service';

async function main() {
  console.log('🤖 Iniciando extração automática do token Whisk...');
  
  const whiskAuthService = new WhiskAuthService();
  
  try {
    // Permitir argumentos de linha de comando
    const args = process.argv.slice(2);
    const headless = args.includes('--headless');
    const email = args.find(arg => arg.startsWith('--email='))?.split('=')[1];
    const password = args.find(arg => arg.startsWith('--password='))?.split('=')[1];
    
    console.log(`📋 Modo: ${headless ? 'Headless' : 'Visual (recomendado para primeira vez)'}`);
    
    if (email) {
      console.log(`👤 Email: ${email}`);
    } else {
      console.log('👤 Email não fornecido - login manual será necessário');
    }
    
    const token = await whiskAuthService.extractWhiskToken(email, password, headless);
    
    // Atualizar .env automaticamente
    await whiskAuthService.updateTokenInEnv(token);
    
    console.log('\n✅ Sucesso! Token extraído e salvo no .env');
    console.log('🚀 Agora você pode executar o projeto normalmente');
    
  } catch (error) {
    console.error('❌ Erro ao extrair token:', error.message);
    console.log('\n📖 Instruções para solução de problemas:');
    console.log('1. Certifique-se de que está logado no Google/Whisk no browser');
    console.log('2. Tente executar sem --headless para ver o que está acontecendo');
    console.log('3. Verifique sua conexão com a internet');
    console.log('4. Se continuar falhando, extraia o token manualmente e coloque no .env');
    
    process.exit(1);
  }
}

main();
