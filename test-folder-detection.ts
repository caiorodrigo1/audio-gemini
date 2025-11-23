import { promises as fs } from 'fs';
import * as path from 'path';

async function findYtFolders(rootFolder: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(rootFolder, { withFileTypes: true });
    const ytFolders = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('YT'))
      .map(entry => path.join(rootFolder, entry.name))
      .sort(); // Ordenar alfabeticamente

    return ytFolders;
  } catch (error) {
    console.error(`Erro ao listar pastas YT: ${error.message}`);
    return [];
  }
}

async function findTxtFilesInFolder(folderPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const txtFiles = entries
      .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.txt'))
      .map(entry => path.join(folderPath, entry.name))
      .sort(); // Ordenar alfabeticamente

    return txtFiles;
  } catch (error) {
    console.error(`Erro ao listar arquivos txt em ${folderPath}: ${error.message}`);
    return [];
  }
}

async function testFolderDetection() {
  const testFolder = './test_structure';

  console.log('🔍 Testando detecção de pastas YT...');
  console.log(`Pasta raiz: ${testFolder}`);

  // Verificar se a pasta existe
  try {
    const stats = await fs.stat(testFolder);
    if (!stats.isDirectory()) {
      console.error(`❌ O caminho especificado não é uma pasta: ${testFolder}`);
      return;
    }
  } catch (error) {
    console.error(`❌ Pasta de teste não encontrada: ${testFolder}`);
    return;
  }

  // Encontrar todas as pastas que começam com YT
  const ytFolders = await findYtFolders(testFolder);
  if (ytFolders.length === 0) {
    console.error(`❌ Nenhuma pasta começando com "YT" encontrada em: ${testFolder}`);
    return;
  }

  console.log(`📂 Encontradas ${ytFolders.length} pastas YT: ${ytFolders.map(f => path.basename(f)).join(', ')}`);

  // Encontrar todos os arquivos txt dentro das pastas YT
  const allTxtFiles: Array<{path: string, ytFolder: string, ytCode: string}> = [];

  for (const ytFolder of ytFolders) {
    const txtFiles = await findTxtFilesInFolder(ytFolder);
    const ytCode = path.basename(ytFolder).substring(0, 4); // Extrair YT01, YT02, etc.

    for (const txtFile of txtFiles) {
      allTxtFiles.push({
        path: txtFile,
        ytFolder: ytFolder,
        ytCode: ytCode
      });
    }
  }

  if (allTxtFiles.length === 0) {
    console.error(`❌ Nenhum arquivo .txt encontrado nas pastas YT.`);
    return;
  }

  console.log(`\n📄 Encontrados ${allTxtFiles.length} arquivo(s) txt para processamento:`);
  allTxtFiles.forEach((file, index) => {
    console.log(`  ${index + 1}. ${file.ytCode} - ${path.basename(file.path)}`);
  });

  console.log('\n✅ Teste de detecção concluído com sucesso!');
}

// Executar teste
testFolderDetection().catch(console.error);



