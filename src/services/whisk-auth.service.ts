import { Injectable } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
export class WhiskAuthService {
  private readonly cookiesPath = path.join(process.cwd(), 'whisk-cookies.json');
  
  /**
   * Extrai automaticamente o token do Whisk usando Puppeteer
   * @param email Email para login (opcional se já logado)
   * @param password Senha para login (opcional se já logado)
   * @param headless Se deve executar em modo headless (padrão: false para debug)
   * @returns Token extraído
   */
  async extractWhiskToken(
    email?: string, 
    password?: string, 
    headless: boolean = false
  ): Promise<string> {
    console.log('🤖 Iniciando automação para extrair token do Whisk...');
    
    const browser = await puppeteer.launch({
      headless,
      defaultViewport: null,
      args: ['--start-maximized']
    });

    try {
      const page = await browser.newPage();
      
      // Carregar cookies salvos se existirem
      await this.loadCookies(page);
      
      // Interceptar requests para capturar o token
      let extractedToken: string | null = null;
      
      page.on('request', request => {
        const headers = request.headers();
        
        // Procurar por Authorization header ou token em headers
        if (headers.authorization) {
          const authHeader = headers.authorization;
          if (authHeader.startsWith('Bearer ')) {
            extractedToken = authHeader.replace('Bearer ', '');
            console.log('🎯 Token encontrado no Authorization header!');
          }
        }
        
        // Procurar por token em outros headers comuns
        if (headers['x-api-key']) {
          extractedToken = headers['x-api-key'];
          console.log('🎯 Token encontrado no X-API-Key header!');
        }
        
        if (headers['x-auth-token']) {
          extractedToken = headers['x-auth-token'];
          console.log('🎯 Token encontrado no X-Auth-Token header!');
        }
      });
      
      page.on('response', async response => {
        try {
          // Interceptar responses que podem conter token
          if (response.url().includes('auth') || response.url().includes('token')) {
            const contentType = response.headers()['content-type'];
            if (contentType && contentType.includes('application/json')) {
              const responseBody = await response.text();
              const jsonData = JSON.parse(responseBody);
              
              // Procurar token no response body
              if (jsonData.token) {
                extractedToken = jsonData.token;
                console.log('🎯 Token encontrado no response body!');
              }
              if (jsonData.access_token) {
                extractedToken = jsonData.access_token;
                console.log('🎯 Access token encontrado no response body!');
              }
            }
          }
        } catch (error) {
          // Ignorar erros de parsing JSON
        }
      });
      
      console.log('🌐 Navegando para o Whisk...');
      await page.goto('https://whisk.google.com/', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Verificar se já está logado
      await new Promise(resolve => setTimeout(resolve, 3000));
      const isLoggedIn = await this.checkIfLoggedIn(page);
      
      if (!isLoggedIn && email && password) {
        console.log('🔑 Fazendo login...');
        await this.performLogin(page, email, password);
      } else if (!isLoggedIn) {
        console.log('⚠️ Não está logado e credenciais não fornecidas. Aguardando login manual...');
        console.log('👤 Por favor, faça login manualmente na página que abriu.');
        
        // Aguardar até detectar que está logado
        await this.waitForLogin(page);
      }
      
      // Salvar cookies após login
      await this.saveCookies(page);
      
      // Navegar para uma página que faça requests com token
      console.log('🔍 Procurando por requisições com token...');
      await page.goto('https://whisk.google.com/create', { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      
      // Aguardar um pouco para capturar requests
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Tentar extrair token do localStorage ou sessionStorage
      if (!extractedToken) {
        console.log('🔍 Procurando token no storage do browser...');
        extractedToken = await this.extractTokenFromStorage(page);
      }
      
      // Tentar fazer uma ação que force uma requisição com token
      if (!extractedToken) {
        console.log('🔄 Tentando forçar requisição com token...');
        await this.triggerTokenRequest(page);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      if (!extractedToken) {
        throw new Error('Não foi possível extrair o token automaticamente. Verifique se está logado corretamente.');
      }
      
      console.log('✅ Token extraído com sucesso!');
      console.log(`🎫 Token: ${extractedToken.substring(0, 20)}...`);
      
      return extractedToken;
      
    } finally {
      if (!headless) {
        console.log('🔍 Browser mantido aberto para debug. Feche manualmente quando terminar.');
        // Não fechar o browser em modo debug
      } else {
        await browser.close();
      }
    }
  }
  
  private async loadCookies(page: puppeteer.Page): Promise<void> {
    try {
      const cookiesString = await fs.readFile(this.cookiesPath, 'utf8');
      const cookies = JSON.parse(cookiesString);
      await page.setCookie(...cookies);
      console.log('🍪 Cookies carregados com sucesso');
    } catch (error) {
      console.log('📝 Nenhum cookie salvo encontrado, começando fresh');
    }
  }
  
  private async saveCookies(page: puppeteer.Page): Promise<void> {
    try {
      const cookies = await page.cookies();
      await fs.writeFile(this.cookiesPath, JSON.stringify(cookies, null, 2));
      console.log('🍪 Cookies salvos para próxima execução');
    } catch (error) {
      console.warn('⚠️ Erro ao salvar cookies:', error.message);
    }
  }
  
  private async checkIfLoggedIn(page: puppeteer.Page): Promise<boolean> {
    try {
      // Procurar por elementos que indicam login
      const loginIndicators = [
        'button[aria-label*="Create"]',
        '[data-testid="create-button"]',
        '.create-btn',
        'a[href*="create"]'
      ];
      
      for (const selector of loginIndicators) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          console.log('✅ Usuário já está logado');
          return true;
        } catch {
          continue;
        }
      }
      
      return false;
    } catch {
      return false;
    }
  }
  
  private async performLogin(page: puppeteer.Page, email: string, password: string): Promise<void> {
    try {
      // Procurar por botão de login/sign in
      const loginSelectors = [
        'button[aria-label*="Sign in"]',
        'button:contains("Sign in")',
        'a:contains("Sign in")',
        '[data-testid="signin-button"]'
      ];
      
      let loginButton = null;
      for (const selector of loginSelectors) {
        try {
          loginButton = await page.waitForSelector(selector, { timeout: 2000 });
          break;
        } catch {
          continue;
        }
      }
      
      if (loginButton) {
        await loginButton.click();
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
      // Aguardar campo de email
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      await page.type('input[type="email"]', email);
      
      // Procurar botão "Next" ou similar
      const nextButton = await page.waitForSelector('button:contains("Next"), input[type="submit"]', { timeout: 5000 });
      await nextButton.click();
      
      // Aguardar campo de senha
      await page.waitForSelector('input[type="password"]', { timeout: 10000 });
      await page.type('input[type="password"]', password);
      
      // Submit
      const submitButton = await page.waitForSelector('button[type="submit"], input[type="submit"]', { timeout: 5000 });
      await submitButton.click();
      
      // Aguardar login completar
      await new Promise(resolve => setTimeout(resolve, 5000));
      
    } catch (error) {
      console.warn('⚠️ Login automático falhou:', error.message);
      console.log('👤 Por favor, complete o login manualmente');
    }
  }
  
  private async waitForLogin(page: puppeteer.Page): Promise<void> {
    console.log('⏳ Aguardando login manual...');
    
    while (true) {
      const isLoggedIn = await this.checkIfLoggedIn(page);
      if (isLoggedIn) {
        console.log('✅ Login detectado!');
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  private async extractTokenFromStorage(page: puppeteer.Page): Promise<string | null> {
    try {
      const token = await page.evaluate(() => {
        // Procurar em localStorage
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          const value = localStorage.getItem(key);
          
          if (key && (key.includes('token') || key.includes('auth'))) {
            return value;
          }
          
          if (value && (value.includes('Bearer ') || value.length > 50)) {
            return value.replace('Bearer ', '');
          }
        }
        
        // Procurar em sessionStorage
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          const value = sessionStorage.getItem(key);
          
          if (key && (key.includes('token') || key.includes('auth'))) {
            return value;
          }
          
          if (value && (value.includes('Bearer ') || value.length > 50)) {
            return value.replace('Bearer ', '');
          }
        }
        
        return null;
      });
      
      if (token) {
        console.log('🎯 Token encontrado no storage do browser!');
        return token;
      }
      
      return null;
    } catch (error) {
      console.warn('⚠️ Erro ao extrair token do storage:', error.message);
      return null;
    }
  }
  
  private async triggerTokenRequest(page: puppeteer.Page): Promise<void> {
    try {
      // Tentar clicar em elementos que podem forçar requisições
      const triggerSelectors = [
        'button[aria-label*="Create"]',
        '[data-testid="create-button"]',
        'button:contains("Create")',
        'button:contains("Generate")'
      ];
      
      for (const selector of triggerSelectors) {
        try {
          const element = await page.waitForSelector(selector, { timeout: 2000 });
          await element.click();
          await new Promise(resolve => setTimeout(resolve, 1000));
          break;
        } catch {
          continue;
        }
      }
    } catch (error) {
      console.warn('⚠️ Não foi possível forçar requisição:', error.message);
    }
  }
  
  /**
   * Método conveniente para atualizar token no .env
   */
  async updateTokenInEnv(newToken: string): Promise<void> {
    try {
      const envPath = path.join(process.cwd(), '.env');
      let envContent = '';
      
      try {
        envContent = await fs.readFile(envPath, 'utf8');
      } catch {
        // Arquivo .env não existe, criar novo
      }
      
      // Atualizar ou adicionar WHISK_TOKEN
      const lines = envContent.split('\n');
      let tokenUpdated = false;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('WHISK_TOKEN=')) {
          lines[i] = `WHISK_TOKEN=${newToken}`;
          tokenUpdated = true;
          break;
        }
      }
      
      if (!tokenUpdated) {
        lines.push(`WHISK_TOKEN=${newToken}`);
      }
      
      await fs.writeFile(envPath, lines.join('\n'));
      console.log('✅ Token atualizado no arquivo .env');
      
    } catch (error) {
      console.error('❌ Erro ao atualizar .env:', error.message);
      throw error;
    }
  }
}
