import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { promises as fs } from 'fs';
import * as path from 'path';

interface TextChunk {
  text: string;
  chunkIndex: number;
  apiKey: string;
}

class Timer {
  private startTime: number;
  private taskName: string;

  constructor(taskName: string) {
    this.taskName = taskName;
    this.startTime = Date.now();
  }

  getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  }

  log(message: string): void {
    console.log(`[${this.getElapsedTime()}] ${message}`);
  }

  logStart(): void {
    console.log(`⏱️ [0m 0s] Iniciando: ${this.taskName}`);
  }

  logEnd(): void {
    console.log(`✅ [${this.getElapsedTime()}] Concluído: ${this.taskName}`);
  }
}

@Injectable()
export class TTSService {
  private readonly openaiApiKey = "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";
  private whiskToken = "ya29.a0AS3H6NyUZhCU2Esz83fZzyLW4i8_Pq2hCxA2GavCsbliqcc2wvTeliqj3IdWuW0Dz9ggsVy7S7B11HQoew9zJ8NVNFEvsUSpIlijiw4gZbKCElnjBAmSKs0sVSu4fe_tDg-ISFrlk5yJKg7SVdSw6f4sdmGWabcyz3q9lVoSPQCE0QaHXuYfKL3xbOApp3KHx7Yuii4VTXOIHSnfZZy1E0WwrGyh4B6wfKL297FaV2p1y82an3oPWC4GzSm0J13syojFfIv-t3EZjLXK7hMnXZolBj5AB2OvasTZ-B5y9di01VDaU40-E2GGlTC2KUF6l746cBCS4yVKqgaCgYKAcQSARISFQHGX2MiaePz9HMG051-49Pud8WClg0341";
  private consoleService: any; // Referência para o console service

  setConsoleService(consoleService: any) {
    this.consoleService = consoleService;
  }

  async updateWhiskToken(newToken: string) {
    this.whiskToken = newToken;
    
    // Salvar o novo token no arquivo permanentemente
    try {
      const filePath = __filename; // Caminho deste arquivo
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Substituir o token antigo pelo novo
      const updatedContent = fileContent.replace(
        /private whiskToken = "[^"]*";/,
        `private whiskToken = "${newToken}";`
      );
      
      await fs.writeFile(filePath, updatedContent, 'utf-8');
      console.log('✅ Token atualizado e salvo permanentemente no código!');
      
    } catch (error) {
      console.warn('⚠️ Token atualizado na memória, mas não foi possível salvar no arquivo:', error.message);
      console.log('✅ Token funcionando na sessão atual!');
    }
  }

  cleanTitleFromFilename(filename: string): string {
    // Remove extensão se houver
    let cleanTitle = filename.replace(/\.(txt|md)$/i, '');
    
    // Agora o título vem limpo sem prefixos, apenas remover extensão é suficiente
    return cleanTitle.trim();
  }

  extractYTCodeFromPath(filePath: string): string | null {
    // Extrair código YT do path ou filename como "YT01", "YT02", etc.
    const match = filePath.match(/YT(\d{2})/i);
    return match ? match[0].toUpperCase() : null;
  }

  getPromptTypeByYTCode(ytCode: string): number {
    const mapping: { [key: string]: number } = {
      'YT01': 4,             // Bridgerton Inglês (EN)
      'YT02': 1,             // Wild West Romance (EN-US)
      'YT03': 6,             // Histórias milionários (PL)
      'YT04': 7,             // Histórias famílias (IT)
      'YT05': 8,             // Histórias milionários (RO)
      'YT06': 9,             // Bridgerton Brasileiro (PT-BR)
      'YT11': 1,             // Wild West (EN-US)
      'YT12': 2,             // Crônicas old man (EN-US)
      'YT13': 3              // Pessoas desaparecidas (PT-BR)
    };
    return mapping[ytCode] || 4; // Default para prompt 4
  }

  getSpecializedPrompt(promptType: number): { systemPrompt: string, userPrompt: string } {
    const prompts = {
      1: { // Wild West (EN-US)
        systemPrompt: 'You are a specialist in creating PHOTOREALISTIC image prompts for Wild West stories targeting American audiences. CRITICAL: Every prompt MUST be photorealistic, never cartoon or illustration. Focus on action, confrontation, heroic individualism, and iconic American frontier elements. Always include authentic American western details: Colt Peacemakers, Stetson hats, saloons, sheriff stars, Monument Valley landscapes. CRITICAL: Maintain visual consistency of characters across all scenes.',
        userPrompt: `Create detailed PHOTOREALISTIC image prompts for Wild West scenes. EVERY prompt must start with "Photorealistic" and include camera details.

FOCUS: Action and confrontation - Americans love westerns with gunfights and duels. Heroic individualism - lone cowboy against adversity. Monumental landscapes - Grand Canyon, Monument Valley, vast deserts. American nostalgia - iconic elements like saloons, sheriffs, bandits.

THUMBNAIL STYLE: Photorealistic professional photograph, cinematic Netflix-style thumbnail featuring rugged American cowboys in classic showdown, shot with 85mm lens, shallow depth of field. Focus on: weathered faces with realistic skin textures and stubble, authentic period Stetsons, leather holsters with Colt Peacemakers, sheriff stars, dusty boots with spurs. Setting: iconic American frontier town with wooden boardwalks, swinging saloon doors, tumbleweeds. Harsh desert sun lighting creating deep shadows, dust particles in air, cinematic quality. American flag subtly visible.

CRITICAL CHARACTER CONSISTENCY:
- ALWAYS specify exact facial features for each character (eye color, nose shape, jaw line, scars, facial hair style)
- Use the SAME character descriptions across all scenes
- For example: "The protagonist (weathered 45-year-old man with steel-gray eyes, prominent square jaw, salt-and-pepper stubble, scar above left eyebrow, wearing black Stetson)"
- Keep supporting characters consistent if they appear multiple times

For each chunk, emphasize: iconic American weapons (Winchester rifles, Colt .45), Old West symbols (horseshoes, lassos, badges), typical bars with poker/whiskey/piano, frontier spirit and American freedom.`
      },
      2: { // Old Man Chronicles (EN-US)
        systemPrompt: 'You are a specialist in creating photorealistic image prompts for first-person elderly American life stories. Focus on American nostalgia, wisdom, subtle patriotism, and traditional values. Include vintage objects from 40s-70s, family values, and American Dream elements.',
        userPrompt: `Create detailed photorealistic image prompts for elderly American life stories.

FOCUS: American nostalgia - vintage objects from 40s-70s. Wisdom and experience - wrinkles that tell stories. Subtle patriotism - flags, military medals, historic photos. Traditional values - family, hard work, American Dream.

THUMBNAIL STYLE: Intimate photorealistic portrait of elderly American man (70-90s) with kind but knowing eyes, deep laugh lines, silver hair. Holding significant object (old photograph, military medal, vintage baseball, worn Bible). Background: cozy American home with family photos, American flag folded in triangle case, vintage radio. Warm window lighting suggesting sunset of life. Nostalgic color grading.

For each chunk, include: American historical landmarks (JFK photos, moon landing, Vietnam), vintage objects (classic cars, old radios, typewriters), generational moments (50s dances, drive-ins, diners), golden nostalgic lighting.`
      },
      3: { // Pessoas Desaparecidas (PT-BR)
        systemPrompt: 'Você é especialista em criar prompts fotorrealistas para histórias de pessoas desaparecidas no Brasil. Foque no regionalismo brasileiro, diversidade étnica, elementos culturais e realismo social. Inclua sempre elementos autênticos brasileiros.',
        userPrompt: `Crie prompts fotorrealistas detalhados para histórias de pessoas desaparecidas no Brasil.

FOCO: Regionalismo brasileiro - favelas, sertão, cidades do interior. Diversidade étnica - rostos brasileiros autênticos. Elementos culturais - santos, fitas do Senhor do Bonfim, terços. Realismo social - cartazes de "Procura-se", delegacias precárias.

ESTILO THUMBNAIL: Composição fotorrealista impactante de mãe brasileira (30-50 anos) segurando foto desgastada de pessoa desaparecida, lágrimas nos olhos, expressão de desespero e esperança. Vestimenta simples típica brasileira. Fundo: mural de desaparecidos em delegacia ou poste de rua, cartazes de "PROCURA-SE" amarelados. Iluminação natural brasileira forte. Elementos: terço nas mãos, fitinha do Bonfim no pulso. Cores vibrantes mas melancólicas.

Para cada chunk, mostre: cenários brasileiros reais (ruas de paralelepípedo, casas coloridas simples), detalhes culturais (imagens de santos, altares domésticos), diversidade regional (nordeste árido, favelas cariocas, interior paulista), rostos brasileiros autênticos com traços indígenas, africanos, europeus misturados.`
      },
      4: { // Romances Estilo Bridgerton (Regência Inglesa)
        systemPrompt: 'You are a specialist in creating PHOTOREALISTIC image prompts for Bridgerton-style historical romances set in English Regency period (1811-1820). CRITICAL: Every prompt MUST be photorealistic, never cartoon or illustration. Focus on London high society, authentic Regency fashion, grand estates, lavish balls, and English aristocracy. Capture the exact Netflix Bridgerton aesthetic with opulent details and romantic atmosphere. CRITICAL: Maintain visual consistency of characters across all scenes.',
        userPrompt: `Create detailed PHOTOREALISTIC image prompts for Bridgerton-style Regency romances set in London. EVERY prompt must start with "Photorealistic" and include camera details.

BRIDGERTON FOCUS: Regency London (1811-1820) - Mayfair society, ton gatherings, English aristocracy. Authentic Regency fashion - empire waist gowns, spencer jackets, pelisses, bonnets, gloves. Men in tailcoats, breeches, cravats, top hats. Settings: Grosvenor Square ballrooms, Hyde Park, country estates, drawing rooms.

BRIDGERTON THUMBNAIL STYLE: Photorealistic professional photograph, opulent Netflix-style scene with English Regency couple, shot with 85mm lens, shallow depth of field, cinematic quality. Woman: empire waist silk gown with intricate beadwork, long gloves, elaborate hair with pearls and feathers, English rose complexion with realistic skin textures. Man: dark blue tailcoat with gold buttons, white cravat, fitted breeches, polished boots, authentic facial details. Setting: grand Mayfair ballroom with crystal chandeliers, marble columns, English garden flowers. Natural candlelight illumination creating dramatic shadows. Rich colors: deep blues, gold, ivory, burgundy.

CRITICAL CHARACTER CONSISTENCY:
- ALWAYS specify exact facial features for each character (eye color, nose shape, bone structure, hair texture, skin tone)
- Use the SAME character descriptions across all scenes
- For example: "The heroine (elegant 22-year-old woman with emerald green eyes, delicate upturned nose, heart-shaped face, auburn curls with golden highlights, porcelain skin with rosy cheeks)"
- For example: "The duke (striking 28-year-old man with piercing blue eyes, strong Roman nose, defined cheekbones, dark brown hair with natural waves, aristocratic bearing)"
- Keep supporting characters consistent if they appear multiple times

AUTHENTIC BRIDGERTON ELEMENTS:
• LOCATIONS: Grosvenor Square ballrooms, Hyde Park promenades, English country estates, Almack's assembly rooms, Bond Street shops, Vauxhall Gardens
• WOMEN'S FASHION: Empire waist gowns in silk/muslin, spencer jackets, pelisses, bonnets with ribbons, long gloves, reticules, fans, jewelry with pearls/diamonds
• MEN'S FASHION: Dark tailcoats, white/colored waistcoats, cravats, fitted breeches, Hessian boots, top hats, walking sticks
• DECOR: Crystal chandeliers, gilded mirrors, Chippendale furniture, Persian rugs, silk wallpaper, oil paintings, fresh flowers
• ENGLISH FLOWERS: Roses, peonies, lavender, jasmine, lily of the valley, arrangements in Chinese porcelain vases
• ATMOSPHERE: English propriety, forbidden romance, social intrigue, masked balls, secret garden meetings, carriage rides through London

For each chunk, create scenes of: Mayfair ballroom dancing, Hyde Park promenades, tea in drawing rooms, opera at Covent Garden, country house parties, morning calls in London townhouses.`
      },
      5: { // Velho Oeste Espanhol (ES)
        systemPrompt: 'Eres especialista en crear prompts fotorrealistas para historias del Viejo Oeste con estilo español. Enfócate en el estilo Spaghetti Western, drama y honor españoles, paisajes áridos ibéricos y toques flamencos.',
        userPrompt: `Crea prompts fotorrealistas detallados para historias del Viejo Oeste español.

ENFOQUE: Estilo Spaghetti Western - influencia de Sergio Leone. Drama y honor - conceptos españoles de venganza y honor. Paisajes áridos ibéricos - Almería, Bardenas Reales. Toque flamenco - guitarras, castañuelas, elementos moriscos.

ESTILO THUMBNAIL: Composición cinematográfica estilo western europeo con pistolero solitario con sombrero cordobés y poncho español enfrentando antagonista. Rostros curtidos mediterráneos, ojos oscuros intensos. Escenario: pueblo español adaptado como western, arquitectura con arcos moriscos, plaza de toros al fondo. Iluminación dramática del mediodía español. Elementos: guitarra española, cruz católica, navaja. Colores tierra con rojos sangre.

Para cada chunk, mezclar: arquitectura española con western (misiones, haciendas), elementos católicos (cruces, santos, procesiones), honor español en duelos y venganzas, paleta de colores ibérica (ocres, rojos, negros).`
      },
      6: { // Histórias Milionários Polonês (PL)
        systemPrompt: 'Jesteś specjalistą tworzenia fotorealistycznych promptów dla emocjonalnych historii milionerów w Polsce. Skup się na głębokich emocjach, kontrastach społecznych, elementach polskich i melancholii słowiańskiej.',
        userPrompt: `Twórz szczegółowe fotorealistyczne prompty dla emocjonalnych historii polskich milionerów.

FOKUS: Głębokie emocje - Polacy cenią intensywne dramaty rodzinne. Kontrast społeczny - nowe bogactwo vs stare tradycje. Elementy polskie - architektura Warszawy, zamki, kościoły. Melancholia słowiańska - nostalgia, zaduma, refleksja.

STYL THUMBNAIL: Dramatyczna scena emocjonalna z polskim milionerem (50-60 lat) w eleganckim garniturze, trzymającym stare zdjęcie rodzinne, łzy w oczach. Twarz słowiańska z głębokimi zmarszczkami. Tło: luksusowe wnętrze z widokiem na Pałac Kultury lub Stare Miasto. Kontrasty: drogie meble i proste polskie pamiątki (krzyż, stara ikona). Oświetlenie: zimne światło zimowe przez okno. Elementy: polski orzeł subtelnie widoczny.

Dla każdego chunka pokazuj: kontrasty emocjonalne (bogactwo vs prostota dzieciństwa), symbole polskie (biały orzeł, bursztyn, premium vodka), intensywne słowiańskie wyrażenia (głęboka melancholia, wybuchowa radość), zimne oświetlenie typowe dla polskiej zimy.`
      },
      7: { // Histórias Famílias Italiano (IT)
        systemPrompt: 'Sei uno specialista nella creazione di prompt fotorealistici per storie emozionanti di famiglie italiane. Concentrati sui legami familiari indistruttibili, gestualità italiana, scenari iconici e cibo come amore.',
        userPrompt: `Crea prompt fotorealistici dettagliati per storie emozionanti di famiglie italiane.

FOCUS: Famiglia è tutto - legami familiari indistruttibili. Gestualità italiana - mani espressive, abbracci calorosi. Scenari iconici - Toscana, villaggi costieri, piazze storiche. Cibo come amore - tavole imbandite, nonne che cucinano.

STILE THUMBNAIL: Scena familiare carica di emozione con famiglia italiana multigenerazionale in momento drammatico. Nonna (80 anni) al centro con mani espressive, circondata da figli e nipoti. Volti mediterranei autentici, lacrime e sorrisi misti. Ambientazione: cucina rustica toscana o terrazza con vista mare. Tavola con pasta, vino, pane. Illuminazione calda dorata. Elementi: foto di famiglia, crocifisso, ramoscelli d'ulivo.

Per ogni chunk, enfatizza: gesti italiani (mani che parlano, abbracci drammatici), tre generazioni sempre insieme, cibo come elemento emotivo (preparazione, condivisione), luce mediterranea dorata e calda.`
      },
      8: { // Histórias Milionários Romeno (RO)
        systemPrompt: 'Ești specialist în crearea de prompt-uri fotorealiste pentru povești emoționante despre milionari români. Concentrează-te pe misterul Carpaților, atmosfera gotică română, drama balcanică și contrastele dintre modernitate și tradiții medievale.',
        userPrompt: `Creează prompt-uri fotorealiste detaliate pentru povești emoționante despre milionari români.

FOCUS: Misterul Carpaților - atmosferă gotică românească. Nou bogat vs aristocrație - castele, tradiții vechi. Dramă balcanică - pasiuni intense, răzbunări familiale. Contraste - modernitate vs tradiții medievale.

STIL THUMBNAIL: Scenă dramatică foto-realistă cu milionar român (45-55 ani) în costum elegant, privind castelul strămoșesc din Carpați. Față est-europeană distinctivă, expresie complexă între triumf și melancolie. Fundal: castel gotic românesc în ceață, munți dramatici. Contrast: Rolls Royce modern lângă poartă medievală. Iluminare: amurg misterios, ceață în văi. Elemente: veche stemă familiei, crucifix ortodox. Culori: negru, burgundy, auriu.

Pentru fiecare chunk, amestecă: elemente moderne și medievale (mașini de lux în castele), misticismul românesc (ceață, păduri întunecate, corbi), biserica ortodoxă (icoane aurite, lumânări), atmosfera gotică a Carpaților.`
      },
      9: { // Bridgerton Brasileiro (PT-BR)
        systemPrompt: 'Você é especialista em criar prompts fotorrealistas para romances históricos estilo Bridgerton ambientados no Brasil Imperial (1822-1889). Foque na alta sociedade brasileira, moda da Regência adaptada ao clima tropical, palácios imperiais, fazendas de café e a corte de D. Pedro II. Misture elegância europeia com exuberância tropical brasileira.',
        userPrompt: `Crie prompts fotorrealistas detalhados para romances históricos estilo Bridgerton no Brasil Imperial.

FOCO BRIDGERTON BRASILEIRO: Período Imperial Brasileiro (1822-1889) - Corte de D. Pedro II, alta sociedade carioca e paulista. Moda Regência tropicalizada - vestidos império em tecidos leves, corpetes bordados com motivos tropicais, luvas de renda, leques de plumas de avestruz. Homens em casacas de linho, coletes bordados, cartolas. Cenários: Palácio de São Cristóvão, Quinta da Boa Vista, Teatro São Pedro, fazendas de café do Vale do Paraíba.

ESTILO THUMBNAIL BRIDGERTON BRASILEIRO: Cena opulenta estilo Netflix com casal da aristocracia imperial brasileira. Mulher: vestido império em seda clara com bordados inspirados na flora tropical, corpete ajustado, luvas longas de renda, cabelos em penteado elaborado com flores de ipê, pele morena dourada aristocrática. Homem: casaca azul imperial com botões dourados, colete bordado com café e cana-de-açúcar, calças justas, cartola, bengala de jacarandá. Cenário: salão de baile do Paço Imperial com lustres de cristal de Baccarat, cortinas de seda francesa, arranjos tropicais luxuosos. Iluminação dourada de velas e lustres. Cores imperiais: azul, dourado, verde e amarelo sutis.

ELEMENTOS BRIDGERTON BRASILEIROS:
• LOCAIS: Paço Imperial Rio de Janeiro, Palácio de Petrópolis, Teatro São João, Jardim Botânico Imperial, fazendas baronesas do café, casarões de Botafogo
• MODA FEMININA: Vestidos império em musselina e seda, corpetes com bordados de orquídeas e beija-flores, xales de cashmere, joias com pedras preciosas brasileiras (esmeraldas, águas-marinhas), leques de plumas exóticas
• MODA MASCULINA: Casacas de linho fino, coletes com bordados tropicais, gravatas de seda, cartolas de feltro, bengalas de madeiras nobres brasileiras (jacarandá, pau-brasil)
• DECORAÇÃO: Lustres franceses, móveis Império tropicalizados, tapetes persas, cortinas de damasco, porcelanas da Companhia das Índias, vasos com orquídeas e bromélias
• FLORES TROPICAIS NOBRES: Orquídeas imperiais, helicônias douradas, antúrios vermelhos, flores de ipê amarelo, arranjos com frutas tropicais cristalizadas
• ATMOSFERA: Opulência tropical imperial, romance na corte brasileira, intrigas palaciais, bailes mascarados, encontros secretos em jardins imperiais

IMPORTANTE: A thumbnail NÃO deve ser renderizada, apenas salva. O vídeo final deve receber o nome do título.

Para cada chunk, criar cenas de: bailes no Paço Imperial, encontros românticos no Jardim Botânico, passeios de carruagem pela Tijuca, saraus na corte, corridas no Jockey Club, cerimônias na Capela Imperial.`
      }
    };

    return prompts[promptType] || prompts[4]; // Default to type 4
  }
  
  // private readonly apiKeys = [
  //   "AIzaSyArTATX_unM1LvawzEQ5uU0LDqj0nyewo4",
  //   "AIzaSyDpZBlFJjTo98ts-bOQpiiIeQUzEoYqDIs",
  //   "AIzaSyCMbntXryqM1_AR-XxDuM4OUP9E8uws844",
  //   "AIzaSyD2KremXOGRuyOC-VdkeIXRysO2zgh235A",
  //   "AIzaSyA54kiI-D7cdKQpjWzSCKIYtGq7OZ-QzLA",
  //   "AIzaSyDpfay9oWW7R6B1UXPZHDU8C5MMCrxTTTA",
  //   "AIzaSyBjVKr4P1ZSIiuFabIij3783xQshWt4fbA",
  //   "AIzaSyA6Ui7v5ivkkjOIFQb00gH31c9hdPqnufw",
  //   "AIzaSyDfFvy7Mw3inP8vh0JyQKG15hH49x2kYEA",
  //   "AIzaSyAGWERC1INGqwW4iMYP7rQnUXY3R1eFjFE",
  //   "AIzaSyCBem2bjbJ828wD8klMPRns0uESLNDgnCQ",
  //   "AIzaSyDRRJATLaDxBhzBI7uEGFjNIex_Ys6eZxM",
  //   "AIzaSyA3C2nCth7Lhbv0DeF7-iDilyePOwS7ASw",
  //   "AIzaSyCY6iFLmD7aHPouoMKSmEhqKDL9WCyp_9A",
  //   "AIzaSyDMUxlPUti4UgZ0qo5hvvAZ8kcMk36Hh88",
  //   "AIzaSyAkVDg7qQng5P6FMRtcqdpdUOByQ5hXcAM",
  //   "AIzaSyDy-wAc8vbLvpv4sBf60MMweBzaDYTWPaA",
  //   "AIzaSyCNVmiFwuyKP7f1InBXngrflHp7-ADLW-M",
  //   "AIzaSyCXYrPNUdNPHJSGpx6jS4jYcUjU8BVvNhE",
  //   "AIzaSyDC_a83LliyC9RqBh7rJ9Ct-RSPD9msZ3M",
  //   "AIzaSyAQUIt_HZ3jm_petnAQB-M5DTc7niuWcqA",
  //   "AIzaSyBWSKNqFT8Gu7bq0MnoAHUQCAwWWcPLs9o",
  //   "AIzaSyBkBKw3NkOTA9GgIKYhVAkEB7UFG_IpMWA",
  //   "AIzaSyBhd-XA1MsSkRN1TdtYR5CmdTVW8p2Svbk"
  // ];

  private readonly apiKeys = [
    "AIzaSyBhd-XA1MsSkRN1TdtYR5CmdTVW8p2Svbk",
    "AIzaSyBkBKw3NkOTA9GgIKYhVAkEB7UFG_IpMWA",
    "AIzaSyBWSKNqFT8Gu7bq0MnoAHUQCAwWWcPLs9o",
    "AIzaSyAQUIt_HZ3jm_petnAQB-M5DTc7niuWcqA",
    "AIzaSyDC_a83LliyC9RqBh7rJ9Ct-RSPD9msZ3M",
    "AIzaSyCXYrPNUdNPHJSGpx6jS4jYcUjU8BVvNhE",
    "AIzaSyCNVmiFwuyKP7f1InBXngrflHp7-ADLW-M",
    "AIzaSyAkVDg7qQng5P6FMRtcqdpdUOByQ5hXcAM",
    "AIzaSyArTATX_unM1LvawzEQ5uU0LDqj0nyewo4",
    "AIzaSyDpZBlFJjTo98ts-bOQpiiIeQUzEoYqDIs",
    "AIzaSyCMbntXryqM1_AR-XxDuM4OUP9E8uws844",
    "AIzaSyD2KremXOGRuyOC-VdkeIXRysO2zgh235A",
    "AIzaSyA54kiI-D7cdKQpjWzSCKIYtGq7OZ-QzLA",
    "AIzaSyDpfay9oWW7R6B1UXPZHDU8C5MMCrxTTTA",
    "AIzaSyBjVKr4P1ZSIiuFabIij3783xQshWt4fbA",
    "AIzaSyA6Ui7v5ivkkjOIFQb00gH31c9hdPqnufw",
    "AIzaSyDfFvy7Mw3inP8vh0JyQKG15hH49x2kYEA",
    "AIzaSyAGWERC1INGqwW4iMYP7rQnUXY3R1eFjFE",
    "AIzaSyCBem2bjbJ828wD8klMPRns0uESLNDgnCQ",
    "AIzaSyDRRJATLaDxBhzBI7uEGFjNIex_Ys6eZxM",
    "AIzaSyA3C2nCth7Lhbv0DeF7-iDilyePOwS7ASw",
    "AIzaSyCY6iFLmD7aHPouoMKSmEhqKDL9WCyp_9A",
    "AIzaSyDMUxlPUti4UgZ0qo5hvvAZ8kcMk36Hh88"
  ];

  // private readonly apiKeys = [
  //   "AIzaSyDfFvy7Mw3inP8vh0JyQKG15hH49x2kYEA",
  //   "AIzaSyAGWERC1INGqwW4iMYP7rQnUXY3R1eFjFE",
  //   "AIzaSyCBem2bjbJ828wD8klMPRns0uESLNDgnCQ",
  //   "AIzaSyDRRJATLaDxBhzBI7uEGFjNIex_Ys6eZxM",
  //   "AIzaSyA3C2nCth7Lhbv0DeF7-iDilyePOwS7ASw",
  //   "AIzaSyCY6iFLmD7aHPouoMKSmEhqKDL9WCyp_9A",
  //   "AIzaSyDMUxlPUti4UgZ0qo5hvvAZ8kcMk36Hh88",
  //   "AIzaSyAkVDg7qQng5P6FMRtcqdpdUOByQ5hXcAM",
  //   "AIzaSyDy-wAc8vbLvpv4sBf60MMweBzaDYTWPaA",
  //   "AIzaSyArTATX_unM1LvawzEQ5uU0LDqj0nyewo4",
  //   "AIzaSyDpZBlFJjTo98ts-bOQpiiIeQUzEoYqDIs",
  //   "AIzaSyCMbntXryqM1_AR-XxDuM4OUP9E8uws844",
  //   "AIzaSyD2KremXOGRuyOC-VdkeIXRysO2zgh235A",
  //   "AIzaSyA54kiI-D7cdKQpjWzSCKIYtGq7OZ-QzLA",
  //   "AIzaSyDpfay9oWW7R6B1UXPZHDU8C5MMCrxTTTA",
  //   "AIzaSyBjVKr4P1ZSIiuFabIij3783xQshWt4fbA",
  //   "AIzaSyA6Ui7v5ivkkjOIFQb00gH31c9hdPqnufw",
  //   "AIzaSyCNVmiFwuyKP7f1InBXngrflHp7-ADLW-M",
  //   "AIzaSyCXYrPNUdNPHJSGpx6jS4jYcUjU8BVvNhE",
  //   "AIzaSyDC_a83LliyC9RqBh7rJ9Ct-RSPD9msZ3M",
  //   "AIzaSyAQUIt_HZ3jm_petnAQB-M5DTc7niuWcqA",
  //   "AIzaSyBWSKNqFT8Gu7bq0MnoAHUQCAwWWcPLs9o",
  //   "AIzaSyBkBKw3NkOTA9GgIKYhVAkEB7UFG_IpMWA",
  //   "AIzaSyBhd-XA1MsSkRN1TdtYR5CmdTVW8p2Svbk"
  // ];

  private readonly maxLength = 3000;

  splitTextIntoChunks(text: string): TextChunk[] {
    console.log(`Texto recebido com ${text.length} caracteres`);
    const cleanText = text.replace(/["""]/g, '').replace(/[''']/g, '');
    console.log(`Texto limpo com ${cleanText.length} caracteres`);
    const chunks: TextChunk[] = [];
    let remainingText = cleanText;
    let chunkIndex = 0;

    while (remainingText.length > 0) {
      if (remainingText.length <= this.maxLength) {
        chunks.push({
          text: remainingText,
          chunkIndex,
          apiKey: this.apiKeys[chunkIndex % this.apiKeys.length]
        });
        break;
      }

      let cutIndex = -1;
      const lastPeriodIndex = remainingText.substring(0, this.maxLength).lastIndexOf('.');
      
      if (lastPeriodIndex !== -1) {
        cutIndex = lastPeriodIndex + 1;
      } else {
        const lastSpaceIndex = remainingText.substring(0, this.maxLength).lastIndexOf(' ');
        cutIndex = lastSpaceIndex !== -1 ? lastSpaceIndex : this.maxLength;
      }

      chunks.push({
        text: remainingText.substring(0, cutIndex).trim(),
        chunkIndex,
        apiKey: this.apiKeys[chunkIndex % this.apiKeys.length]
      });

      remainingText = remainingText.substring(cutIndex).trim();
      chunkIndex++;
    }

    return chunks;
  }

  async convertToSpeech(chunk: TextChunk): Promise<Buffer> {
    const maxRetries = 3;
    let lastError: any;
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Escolher uma API key diferente a cada tentativa
      const apiKeyIndex = (this.apiKeys.indexOf(chunk.apiKey) + attempt) % this.apiKeys.length;
      const currentApiKey = this.apiKeys[apiKeyIndex];
      
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:streamGenerateContent?key=${currentApiKey}`;
      
      const payload = {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: chunk.text
              }
            ]
          }
        ],
        generationConfig: {
          responseModalities: ["audio"],
          temperature: 1,
          speech_config: {
            voice_config: {
              prebuilt_voice_config: {
                voice_name: "Algenib"
              }
            }
          }
        }
      };

      try {
        if (attempt > 0) {
          console.log(`Tentativa ${attempt + 1} para chunk ${chunk.chunkIndex + 1} com API key ${apiKeyIndex + 1}...`);
          // Delay adicional nas tentativas subsequentes
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }

        const response = await axios.post(url, payload, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        // A resposta é um array, pegar o primeiro elemento
        const responseData = Array.isArray(response.data) ? response.data[0] : response.data;
        
        // Verificar se a resposta tem a estrutura esperada
        if (!responseData || !responseData.candidates || !responseData.candidates[0]) {
          throw new Error(`Resposta inválida da API - sem candidates: ${JSON.stringify(responseData)}`);
        }

        if (!responseData.candidates[0].content || !responseData.candidates[0].content.parts || !responseData.candidates[0].content.parts[0]) {
          throw new Error(`Resposta inválida da API - sem content/parts: ${JSON.stringify(responseData.candidates[0])}`);
        }

        if (!responseData.candidates[0].content.parts[0].inlineData || !responseData.candidates[0].content.parts[0].inlineData.data) {
          throw new Error(`Resposta inválida da API - sem inlineData: ${JSON.stringify(responseData.candidates[0].content.parts[0])}`);
        }

        const audioData = responseData.candidates[0].content.parts[0].inlineData.data;
        if (attempt > 0) {
          console.log(`✅ Chunk ${chunk.chunkIndex + 1} convertido com sucesso na tentativa ${attempt + 1}!`);
        }
        return Buffer.from(audioData, 'base64');
        
      } catch (error) {
        lastError = error;
        const isRateLimit = error.response?.status === 429;
        const isQuotaError = error.response?.data?.[0]?.error?.code === 429;
        
        console.error(`❌ Tentativa ${attempt + 1} falhou para chunk ${chunk.chunkIndex + 1}:`, error.message);
        
        // Debug adicional para entender o erro
        if (error.response) {
          console.error(`Status: ${error.response.status}`);
          console.error(`Response data:`, JSON.stringify(error.response.data, null, 2));
        }
        
        if (isRateLimit || isQuotaError) {
          console.log(`🔄 Rate limit/quota excedida, tentando com próxima API key...`);
          if (attempt < maxRetries - 1) {
            continue; // Tentar próxima API key
          }
        } else {
          // Para outros erros, tentar uma vez mais com API key diferente
          if (attempt < maxRetries - 1) {
            console.log(`🔄 Tentando com próxima API key...`);
            continue;
          }
          break;
        }
      }
    }
    
    console.error(`❌ Todas as tentativas falharam para chunk ${chunk.chunkIndex + 1}`);
    if (lastError.response) {
      console.error('Última resposta da API:', lastError.response.data);
    }
    throw lastError;
  }

  convertToWav(rawBuffer: Buffer): Buffer {
    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const wavHeaderSize = 44;
    const dataSize = rawBuffer.length;
    const fileSize = wavHeaderSize + dataSize - 8;
    
    const header = Buffer.alloc(wavHeaderSize);
    
    header.write('RIFF', 0);
    header.writeUInt32LE(fileSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    
    return Buffer.concat([header, rawBuffer]);
  }

  async saveAudioFile(wavBuffer: Buffer, chunkIndex: number, outputDir: string): Promise<string> {
    const fileName = `output_audio_${chunkIndex}.wav`;
    const filePath = path.join(outputDir, fileName);
    
    await fs.writeFile(filePath, wavBuffer);
    return filePath;
  }

  playNotificationSound(): void {
    try {
      // Para Windows
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        // Som de notificação padrão do Windows
        exec('powershell -c "[System.Media.SystemSounds]::Beep.Play()"', (error) => {
          if (error) {
            console.log('🔔 Som de notificação tocado!');
          }
        });
      } else {
        // Para sistemas Unix (macOS/Linux)
        const { exec } = require('child_process');
        exec('echo -e "\\a"', () => {});
      }
    } catch (error) {
      // Falback silencioso se não conseguir tocar som
    }
  }

  async processTextToSpeech(text: string, outputDir: string = 'D:\\Canais Dark', filePath?: string): Promise<string[]> {
    const totalTimer = new Timer('Processamento completo');
    totalTimer.logStart();

    if (!text) {
      throw new Error('Nenhum texto foi fornecido.');
    }

    // Criar diretório de saída se não existir
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      // Diretório já existe
    }

    const chunks = this.splitTextIntoChunks(text);
    const savedFiles: string[] = [];

    totalTimer.log(`Processando ${chunks.length} chunks de texto...`);

    // Processamento em blocos de 5 chunks para melhor performance
    const audioTimer = new Timer('Conversão de áudio');
    audioTimer.logStart();
    
    const batchSize = 5;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      totalTimer.log(`Processando bloco ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)...`);
      
      // Processar chunks do bloco em paralelo
      const batchPromises = batch.map(async (chunk) => {
        try {
          audioTimer.log(`Iniciando conversão do chunk ${chunk.chunkIndex + 1}/${chunks.length}...`);
          
          const rawAudio = await this.convertToSpeech(chunk);
          const wavAudio = this.convertToWav(rawAudio);
          const filePath = await this.saveAudioFile(wavAudio, chunk.chunkIndex, outputDir);
          
          audioTimer.log(`Chunk ${chunk.chunkIndex + 1} salvo: ${path.basename(filePath)}`);
          return filePath;
          
        } catch (error) {
          audioTimer.log(`❌ Erro ao processar chunk ${chunk.chunkIndex + 1}: ${error.message}`);
          audioTimer.log('Continuando com próximo chunk...');
          return null;
        }
      });
      
      // Aguardar todos os chunks do bloco terminarem
      const batchResults = await Promise.allSettled(batchPromises);
      
      // Coletar chunks que falharam para retry
      const failedChunks: TextChunk[] = [];
      
      // Adicionar apenas os resultados bem-sucedidos
      batchResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          savedFiles.push(result.value);
        } else {
          // Chunk falhou, adicionar para retry
          failedChunks.push(batch[index]);
        }
      });
      
      // Retry dos chunks que falharam
      if (failedChunks.length > 0) {
        audioTimer.log(`🔄 Tentando novamente ${failedChunks.length} chunk(s) que falharam...`);
        
        for (const failedChunk of failedChunks) {
          try {
            audioTimer.log(`🔄 Retry chunk ${failedChunk.chunkIndex + 1}/${chunks.length}...`);
            
            const rawAudio = await this.convertToSpeech(failedChunk);
            const wavAudio = this.convertToWav(rawAudio);
            const filePath = await this.saveAudioFile(wavAudio, failedChunk.chunkIndex, outputDir);
            
            savedFiles.push(filePath);
            audioTimer.log(`✅ Chunk ${failedChunk.chunkIndex + 1} salvo no retry: ${path.basename(filePath)}`);
            
          } catch (retryError) {
            audioTimer.log(`❌ Retry falhou para chunk ${failedChunk.chunkIndex + 1}: ${retryError.message}`);
            audioTimer.log(`⏭️ Pulando chunk ${failedChunk.chunkIndex + 1} definitivamente`);
          }
          
          // Delay entre retries
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // Delay entre blocos para evitar rate limiting
      if (i + batchSize < chunks.length) {
        audioTimer.log('Aguardando antes do próximo bloco...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    audioTimer.logEnd();
    
    // Estatísticas finais
    const totalChunks = chunks.length;
    const successfulChunks = savedFiles.length;
    const failedChunks = totalChunks - successfulChunks;
    
    totalTimer.log(`📊 Estatísticas de áudio: ${successfulChunks}/${totalChunks} chunks convertidos`);
    if (failedChunks > 0) {
      totalTimer.log(`⚠️ ${failedChunks} chunk(s) falharam definitivamente`);
    }

    // Gerar prompts de imagem após conversão de áudio
    try {
      // Detectar código YT e determinar tipo de prompt primeiro
      let promptType = 4; // Default
      let cleanTitle = '';
      
      if (filePath) {
        const ytCode = this.extractYTCodeFromPath(filePath);
        const fileName = path.basename(filePath, path.extname(filePath));
        cleanTitle = this.cleanTitleFromFilename(fileName);
        
        if (ytCode) {
          promptType = this.getPromptTypeByYTCode(ytCode);
          totalTimer.log(`📁 Código detectado: ${ytCode} → Usando prompt tipo ${promptType}`);
        }
      }
      
      totalTimer.log('🎨 Gerando prompts de imagem...');
      const promptTimer = new Timer('Geração de prompts');
      promptTimer.logStart();
      promptTimer.log('📝 Analisando personagens para consistência visual...');
      const prompts = await this.generateImagePrompts(chunks, outputDir, promptType);
      promptTimer.logEnd();
      
      // Gerar thumbnail separada baseada no título limpo
      if (cleanTitle) {
        totalTimer.log('🎯 Gerando thumbnail baseada no título...');
        const thumbnailTimer = new Timer('Geração de thumbnail');
        thumbnailTimer.logStart();
        await this.generateThumbnail(cleanTitle, outputDir, promptType);
        thumbnailTimer.logEnd();
      }
      
      // Gerar imagens com Whisk após prompts
      totalTimer.log('🖼️ Gerando imagens com Whisk...');
      const imageTimer = new Timer('Geração de imagens');
      imageTimer.logStart();
      await this.generateImagesWithWhisk(prompts, outputDir);
      imageTimer.logEnd();

      // Renderizar vídeo final com FFmpeg
      totalTimer.log('🎬 Renderizando vídeo final...');
      const videoTimer = new Timer('Renderização de vídeo');
      videoTimer.logStart();
      await this.renderVideoWithFFmpeg(outputDir, filePath);
      videoTimer.logEnd();
      
    } catch (error) {
      totalTimer.log(`❌ Erro ao gerar prompts/imagens/vídeo: ${error.message}`);
      totalTimer.log('Áudios foram gerados com sucesso, mas prompts/imagens/vídeo falharam.');
      totalTimer.log(`💡 Para tentar renderizar o vídeo novamente, use o comando:`);
      totalTimer.log(`   RENDER "${outputDir}"`);
    }

    totalTimer.logEnd();
    console.log(`\n🎯 TEMPO TOTAL DE EXECUÇÃO: ${totalTimer.getElapsedTime()}`);
    
    // Tocar som de notificação quando terminar
    this.playNotificationSound();
    console.log('🔔 Processo concluído! Som de notificação emitido.');

    return savedFiles;
  }

  async analyzeCharacters(fullText: string, promptType: number): Promise<string> {
    const specializedPrompt = this.getSpecializedPrompt(promptType);
    
    const analysisPrompt = `Analise o seguinte texto e identifique os personagens principais e suas características físicas específicas.
    
TEXTO PARA ANÁLISE:
${fullText}

INSTRUÇÕES:
- Identifique os personagens principais da história
- Para cada personagem, extraia características físicas específicas mencionadas no texto
- Se não houver descrições físicas específicas, crie características consistentes baseadas no contexto e tipo de história
- Foque em: idade, cabelo (cor, estilo), olhos (cor, formato), rosto (formato, traços), altura, constituição física
- Use o contexto cultural/temporal da história para criar características apropriadas

FORMATO DE RESPOSTA:
PERSONAGEM 1: [Nome ou descrição]
- Idade: [idade específica]
- Cabelo: [cor, estilo, textura]
- Olhos: [cor, formato]
- Rosto: [formato, traços específicos]
- Físico: [altura, constituição]
- Outros detalhes: [cicatrizes, barba, etc.]

PERSONAGEM 2: [Nome ou descrição]
- [mesma estrutura]

Seja específico e detalhado para garantir consistência visual.`;

    try {
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `${specializedPrompt.systemPrompt} Você é especialista em identificar e descrever personagens para manter consistência visual em imagens.`
          },
          {
            role: 'user',
            content: analysisPrompt
          }
        ],
        max_tokens: 800,
        temperature: 0.3
      }, {
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      console.error('❌ Erro ao analisar personagens:', error.message);
      return 'ERRO: Não foi possível analisar personagens. Use descrições genéricas consistentes.';
    }
  }

  async generateImagePrompts(chunks: TextChunk[], outputDir: string, promptType: number): Promise<string[]> {
    const batchSize = 5;
    const allPrompts: string[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} para prompts de imagem...`);

      try {
        const prompts = await this.callChatGPT(batch, promptType, outputDir);
        allPrompts.push(...prompts);
        console.log(`✅ Gerados ${prompts.length} prompts para o lote`);
      } catch (error) {
        console.error(`❌ Erro ao processar lote ${Math.floor(i / batchSize) + 1}:`, error.message);
        // Adicionar prompts vazios para manter numeração
        for (let j = 0; j < batch.length; j++) {
          allPrompts.push(`[ERRO] Não foi possível gerar prompt para o chunk ${batch[j].chunkIndex + 1}`);
        }
      }

      // Delay entre lotes
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Salvar prompts em arquivo
    await this.saveImagePrompts(allPrompts, outputDir);
    
    return allPrompts;
  }

  async callChatGPT(chunks: TextChunk[], promptType: number = 4, outputDir?: string): Promise<string[]> {
    const chunksText = chunks.map((chunk, index) => 
      `=== CHUNK ${chunk.chunkIndex + 1} ===\n${chunk.text}\n`
    ).join('\n');

    const specializedPrompt = this.getSpecializedPrompt(promptType);
    
    // Primeiro, analisar o texto para identificar personagens
    const characterAnalysis = await this.analyzeCharacters(chunksText, promptType);
    
    // Salvar análise de personagens se outputDir for fornecido
    if (outputDir) {
      await this.saveCharacterAnalysis(characterAnalysis, outputDir);
    }
    
    const prompt = `${specializedPrompt.userPrompt}

ANÁLISE DE PERSONAGENS (MANTENHA CONSISTÊNCIA VISUAL):
${characterAnalysis}

INSTRUÇÕES DE CONSISTÊNCIA VISUAL:
- SEMPRE use as características faciais específicas dos personagens identificados acima
- MANTENHA os mesmos traços físicos (formato do rosto, nariz, olhos, boca, cabelo, idade) em TODAS as imagens
- Para personagens principais, SEMPRE inclua: cor dos olhos, formato do nariz, tipo de cabelo, idade aparente, estrutura facial
- Se um personagem aparece em múltiplas cenas, use EXATAMENTE as mesmas características físicas
- Para personagens secundários, mantenha consistência se aparecerem novamente

INSTRUÇÕES DE FOTORREALISMO OBRIGATÓRIAS:
- SEMPRE comece cada prompt com "Photorealistic" ou "Hyperrealistic"
- SEMPRE inclua "cinematic quality", "professional photography", "high detail"
- SEMPRE especifique "realistic skin textures", "natural lighting", "authentic facial expressions"
- NUNCA use palavras como "cartoon", "animated", "illustration", "drawing", "art", "painting"
- SEMPRE prefira "photograph" ao invés de "image"
- Inclua detalhes técnicos: "shot with professional camera", "85mm lens", "shallow depth of field"

${chunksText}

Para cada chunk, retorne apenas o prompt de imagem, um por linha, numerado sequencialmente. 
O PRIMEIRO prompt deve ser uma THUMBNAIL de alto CTR conforme especificado no estilo.
IMPORTANTE: Use as características dos personagens identificadas acima para manter consistência visual.
Mantenha cada prompt em uma única linha.

Formato esperado:
1. [THUMBNAIL - prompt especializado para chunk 1 COM características específicas dos personagens]
2. [prompt especializado para chunk 2 COM características específicas dos personagens]  
3. [prompt especializado para chunk 3 COM características específicas dos personagens]
...`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: specializedPrompt.systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    const content = response.data.choices[0].message.content;
    
    // Extrair prompts numerados
    const lines = content.split('\n').filter((line: string) => line.trim());
    const prompts = lines
      .filter((line: string) => /^\d+\.\s/.test(line.trim()))
      .map((line: string) => line.replace(/^\d+\.\s/, '').trim());

    return prompts;
  }

  async saveImagePrompts(prompts: string[], outputDir: string): Promise<void> {
    const fileName = 'prompts_de_imagem.txt';
    const filePath = path.join(outputDir, fileName);
    
    const content = prompts.map((prompt, index) => 
      `=== PROMPT ${index + 1} ===\n${prompt}\n=== IMAGEM CORRESPONDENTE: imagem_${index + 1}.jpg ===\n`
    ).join('\n');

    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`📝 Prompts de imagem salvos em: ${filePath}`);
  }

  async saveCharacterAnalysis(characterAnalysis: string, outputDir: string): Promise<void> {
    const fileName = 'analise_personagens.txt';
    const filePath = path.join(outputDir, fileName);
    
    const content = `=== ANÁLISE DE PERSONAGENS PARA CONSISTÊNCIA VISUAL ===

${characterAnalysis}

=== INSTRUÇÕES ===
Este arquivo contém a análise dos personagens principais da história.
Use estas características para manter consistência visual em todas as imagens.
Cada personagem deve ter EXATAMENTE as mesmas características físicas em todas as cenas.

Data de criação: ${new Date().toLocaleString('pt-BR')}
`;

    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`👥 Análise de personagens salva em: ${filePath}`);
  }

  async generateImagesWithWhisk(prompts: string[], outputDir: string): Promise<void> {
    const imageGenTimer = new Timer('Geração individual de imagens');
    
    if (prompts.length === 0) {
      imageGenTimer.log('❌ Nenhum prompt disponível para gerar imagens');
      return;
    }

    imageGenTimer.log(`🖼️ Gerando ${prompts.length} imagem(ns) com Whisk...`);

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i];
      if (prompt.startsWith('[ERRO]')) {
        imageGenTimer.log(`⏭️ Pulando prompt ${i + 1} (erro)`);
        continue;
      }

      // Tentar gerar imagem com correção automática de prompts inválidos
      const success = await this.tryGenerateImageWithCorrection(prompt, i, outputDir, imageGenTimer);
      
      if (success) {
        imageGenTimer.log(`✅ Imagem ${i + 1} salva com sucesso`);
      } else {
        imageGenTimer.log(`❌ Pulando imagem ${i + 1} após 3 tentativas de correção`);
      }

      // Delay entre imagens para evitar rate limiting
      if (i < prompts.length - 1) {
        imageGenTimer.log(`⏳ Aguardando 3s antes da próxima imagem...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
  }

  async tryGenerateImageWithCorrection(originalPrompt: string, imageIndex: number, outputDir: string, timer?: Timer): Promise<boolean> {
    let currentPrompt = originalPrompt;
    const maxCorrections = 3;

    for (let correctionAttempt = 0; correctionAttempt < maxCorrections; correctionAttempt++) {
      try {
        if (timer) {
          timer.log(`🎨 Gerando imagem ${imageIndex + 1} (tentativa ${correctionAttempt + 1}/3)...`);
        }
        const imageBuffer = await this.callWhiskAPI(currentPrompt);
        await this.saveImage(imageBuffer, imageIndex, outputDir);
        return true; // Sucesso!
        
      } catch (error) {
        const isInvalidArgument = error.response?.status === 400 && 
                                 error.response?.data?.error?.code === 400 &&
                                 error.response?.data?.error?.status === 'INVALID_ARGUMENT';
        
        if (isInvalidArgument && correctionAttempt < maxCorrections - 1) {
          if (timer) {
            timer.log(`❌ Prompt inválido detectado. Pedindo correção ao ChatGPT...`);
          }
          
          try {
            const correctedPrompt = await this.fixInvalidPrompt(currentPrompt, error.response.data.error.message);
            currentPrompt = correctedPrompt;
            if (timer) {
              timer.log(`🔄 Prompt corrigido. Tentando novamente...`);
            }
            
          } catch (fixError) {
            if (timer) {
              timer.log(`❌ Erro ao corrigir prompt: ${fixError.message}`);
            }
            return false;
          }
          
        } else {
          if (timer) {
            timer.log(`❌ Erro ao gerar imagem após ${correctionAttempt + 1} tentativas: ${error.message}`);
          }
          if (correctionAttempt === maxCorrections - 1) {
            return false; // Falhou todas as tentativas
          }
        }
      }
    }
    
    return false;
  }

  async fixInvalidPrompt(invalidPrompt: string, errorMessage: string): Promise<string> {
    const correctionPrompt = `O seguinte prompt para geração de imagem foi rejeitado pelo Whisk API com erro 400:

PROMPT INVÁLIDO:
"${invalidPrompt}"

ERRO RETORNADO:
"${errorMessage}"

Por favor, corrija este prompt removendo elementos que podem causar violação das políticas do Whisk:
- Remova referências a pessoas reais específicas
- Remova conteúdo violento, sexual ou inapropriado  
- Simplifique descrições muito complexas
- Mantenha o estilo e essência da cena
- Retorne apenas o prompt corrigido, sem explicações

PROMPT CORRIGIDO:`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um especialista em corrigir prompts de imagem para APIs que rejeitam conteúdo inadequado. Seja conciso e mantenha a essência da cena.'
        },
        {
          role: 'user',
          content: correctionPrompt
        }
      ],
      max_tokens: 300,
      temperature: 0.3
    }, {
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  }

  async callWhiskAPI(prompt: string): Promise<Buffer> {
    const maxRetries = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          console.log(`🔄 Tentativa ${attempt + 1}/${maxRetries} para gerar imagem...`);
          // Delay progressivo entre tentativas
          await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
        }

        const payload = {
          clientContext: {
            workflowId: this.generateUUID(),
            tool: "BACKBONE",
            sessionId: `;${Date.now()}`
          },
          imageModelSettings: {
            imageModel: "IMAGEN_3_5",
            aspectRatio: "IMAGE_ASPECT_RATIO_LANDSCAPE"
          },
          seed: Math.floor(Math.random() * 1000000),
          prompt: prompt,
          mediaCategory: "MEDIA_CATEGORY_BOARD"
        };

        const response = await axios.post('https://aisandbox-pa.googleapis.com/v1/whisk:generateImage', payload, {
          headers: {
            'accept': '*/*',
            'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7,it;q=0.6',
            'authorization': `Bearer ${this.whiskToken}`,
            'cache-control': 'no-cache',
            'content-type': 'application/json',
            'origin': 'https://labs.google',
            'pragma': 'no-cache',
            'priority': 'u=1, i',
            'referer': 'https://labs.google/',
            'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'sec-fetch-dest': 'empty',
            'sec-fetch-mode': 'cors',
            'sec-fetch-site': 'cross-site',
            'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
            'x-browser-channel': 'stable',
            'x-browser-copyright': 'Copyright 2025 Google LLC. All rights reserved.',
            'x-browser-validation': '6h3XF8YcD8syi2FF2BbuE2KllQo=',
            'x-browser-year': '2025',
            'x-client-data': 'CKW1yQEIjbbJAQiktskBCKmdygEI34DLAQiTocsBCKSjywEIhaDNAQjh8M4BCKXyzgE='
          }
        });

        // Extrair a imagem base64 da resposta
        const responseData = response.data;
        
        if (!responseData || !responseData.imagePanels || !responseData.imagePanels[0] || 
            !responseData.imagePanels[0].generatedImages || !responseData.imagePanels[0].generatedImages[0] ||
            !responseData.imagePanels[0].generatedImages[0].encodedImage) {
          throw new Error(`Resposta inválida do Whisk: ${JSON.stringify(responseData)}`);
        }

        // Decodificar base64 para buffer
        const base64Image = responseData.imagePanels[0].generatedImages[0].encodedImage;
        
        if (attempt > 0) {
          console.log(`✅ Imagem gerada com sucesso na tentativa ${attempt + 1}!`);
        }
        
        return Buffer.from(base64Image, 'base64');

      } catch (error) {
        lastError = error;
        const isUnauthorized = error.response?.status === 401;
        const isRateLimit = error.response?.status === 429;
        const isServerError = error.response?.status >= 500;
        
        console.error(`❌ Tentativa ${attempt + 1}/${maxRetries} falhou:`, error.message);
        
        if (isUnauthorized) {
          console.log(`🔑 Erro de autenticação detectado (401)`);
          
          if (this.consoleService && typeof this.consoleService.promptForNewToken === 'function') {
            try {
              const newToken = await this.consoleService.promptForNewToken();
              if (newToken && newToken.length > 10) {
                await this.updateWhiskToken(newToken);
                console.log(`🔄 Tentando novamente com o novo token...`);
                continue; // Tentar novamente com novo token
              } else {
                console.log(`❌ Token inválido fornecido`);
                break;
              }
            } catch (tokenError) {
              console.error(`❌ Erro ao obter novo token:`, tokenError.message);
              break;
            }
          } else {
            console.log(`❌ Console service não disponível para solicitar novo token`);
            break;
          }
        } else if (isRateLimit || isServerError) {
          console.log(`🔄 Erro de rate limit/servidor, tentando novamente...`);
          if (attempt < maxRetries - 1) {
            continue; // Tentar novamente
          }
        } else {
          // Erro que não é recuperável - não tentar novamente
          break;
        }
      }
    }
    
    console.error(`❌ Todas as ${maxRetries} tentativas falharam para gerar imagem`);
    if (lastError.response) {
      console.error('Última resposta da API:', lastError.response.data);
    }
    throw lastError;
  }

  async saveImage(imageBuffer: Buffer, imageIndex: number, outputDir: string): Promise<void> {
    const fileName = `imagem_${imageIndex + 1}.jpg`;
    const filePath = path.join(outputDir, fileName);
    
    // Salvar imagem original primeiro
    await fs.writeFile(filePath, imageBuffer);
    console.log(`🖼️ Imagem ${imageIndex + 1} salva: ${fileName}`);
    
    // Fazer upscaling/crop para 1920x1080
    await this.upscaleImageTo1920x1080(filePath, outputDir, imageIndex);
  }

  async saveThumbnail(imageBuffer: Buffer, cleanTitle: string, outputDir: string): Promise<void> {
    const fileName = `${cleanTitle}.jpg`;
    const filePath = path.join(outputDir, fileName);
    
    // Salvar thumbnail original primeiro
    await fs.writeFile(filePath, imageBuffer);
    console.log(`🎯 Thumbnail salva: ${fileName}`);
    
    // Fazer upscaling/crop para 1920x1080
    await this.upscaleThumbnailTo1920x1080(filePath, cleanTitle, outputDir);
  }

  async generateThumbnail(cleanTitle: string, outputDir: string, promptType: number): Promise<void> {
    try {
      console.log(`🎯 Criando thumbnail para: "${cleanTitle}"`);
      
      // Gerar prompt de thumbnail baseado no título e tipo de prompt
      const thumbnailPrompt = await this.generateThumbnailPrompt(cleanTitle, promptType);
      
      // Gerar imagem com Whisk
      const imageBuffer = await this.callWhiskAPI(thumbnailPrompt);
      
      // Salvar thumbnail com nome do título
      await this.saveThumbnail(imageBuffer, cleanTitle, outputDir);
      
      console.log(`✅ Thumbnail gerada com sucesso: ${cleanTitle}.jpg`);
      
    } catch (error) {
      console.error(`❌ Erro ao gerar thumbnail para "${cleanTitle}":`, error.message);
    }
  }

  async generateThumbnailPrompt(cleanTitle: string, promptType: number): Promise<string> {
    const specializedPrompt = this.getSpecializedPrompt(promptType);
    
    const prompt = `${specializedPrompt.userPrompt}

TÍTULO DA HISTÓRIA: "${cleanTitle}"

Crie um prompt de THUMBNAIL de alto CTR baseado neste título. 
A thumbnail deve ser atraente, dramática e representar perfeitamente o tema "${cleanTitle}".
Use o estilo especializado definido acima, mas focado especificamente neste título.
Retorne apenas o prompt da thumbnail, uma única linha.`;

    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: specializedPrompt.systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data.choices[0].message.content.trim();
  }

  async upscaleImageTo1920x1080(originalPath: string, outputDir: string, imageIndex: number): Promise<void> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    const upscaleTimer = new Timer(`Upscaling imagem ${imageIndex + 1}`);
    
    try {
      upscaleTimer.log(`🔍 Fazendo upscaling da imagem ${imageIndex + 1} para 1920x1080...`);
      
      // Criar arquivo de saída 1920x1080
      const upscaledFileName = `imagem_${imageIndex + 1}_1920x1080.jpg`;
      const upscaledPath = path.join(outputDir, upscaledFileName);
      
      // Comando FFmpeg: Scale com zoom ligeiro para preencher 1920x1080 sem padding
      // Usa 'increase' com crop mínimo para eliminar bordas pretas
      const ffmpegCommand = `ffmpeg -y -v error -i "${originalPath}" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" -q:v 2 "${upscaledPath}"`;
      
      await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 5, timeout: 30000 });
      
      upscaleTimer.log(`✅ Imagem ${imageIndex + 1} upscaled para 1920x1080: ${upscaledFileName}`);
      
      // Substituir a imagem original pela upscaled
      await fs.unlink(originalPath);
      await fs.rename(upscaledPath, originalPath);
      
      upscaleTimer.log(`🔄 Imagem ${imageIndex + 1} substituída pela versão 1920x1080`);
      
    } catch (error) {
      upscaleTimer.log(`❌ Erro ao fazer upscaling da imagem ${imageIndex + 1}: ${error.message}`);
      upscaleTimer.log(`⚠️ Mantendo imagem original`);
    }
  }

  async upscaleThumbnailTo1920x1080(originalPath: string, cleanTitle: string, outputDir: string): Promise<void> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    try {
      console.log(`🔍 Fazendo upscaling da thumbnail "${cleanTitle}" para 1920x1080...`);
      
      // Criar arquivo de saída 1920x1080
      const upscaledFileName = `${cleanTitle}_1920x1080.jpg`;
      const upscaledPath = path.join(outputDir, upscaledFileName);
      
      // Comando FFmpeg: Scale com zoom ligeiro para preencher 1920x1080 sem padding
      const ffmpegCommand = `ffmpeg -y -v error -i "${originalPath}" -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080" -q:v 2 "${upscaledPath}"`;
      
      await execAsync(ffmpegCommand, { maxBuffer: 1024 * 1024 * 5, timeout: 30000 });
      
      console.log(`✅ Thumbnail "${cleanTitle}" upscaled para 1920x1080: ${upscaledFileName}`);
      
      // Substituir a thumbnail original pela upscaled
      await fs.unlink(originalPath);
      await fs.rename(upscaledPath, originalPath);
      
      console.log(`🔄 Thumbnail "${cleanTitle}" substituída pela versão 1920x1080`);
      
    } catch (error) {
      console.error(`❌ Erro ao fazer upscaling da thumbnail "${cleanTitle}":`, error.message);
      console.log(`⚠️ Mantendo thumbnail original`);
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  async renderVideoWithFFmpeg(outputDir: string, filePath?: string): Promise<string> {
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);

    try {
      // Verificar se FFmpeg está instalado
      try {
        await execAsync('ffmpeg -version', { maxBuffer: 1024 * 1024 * 5 }); // 5MB buffer
      } catch (error) {
        throw new Error(`FFmpeg não encontrado. Por favor, instale o FFmpeg:
        
📥 INSTALAÇÃO DO FFMPEG:
Windows: 
1. Baixe de: https://ffmpeg.org/download.html#build-windows
2. Extraia e adicione ao PATH do sistema
3. Ou use: winget install FFmpeg

Linux/Mac:
- Ubuntu/Debian: sudo apt install ffmpeg
- CentOS/RHEL: sudo yum install ffmpeg
- macOS: brew install ffmpeg

❗ Após a instalação, reinicie o terminal e tente novamente.`);
      }

      console.log('🎬 Iniciando renderização do vídeo com FFmpeg...');

      // Verificar se os arquivos de áudio e imagem existem
      const audioFiles = await this.getAudioFiles(outputDir);
      const imageFiles = await this.getImageFiles(outputDir);

      if (audioFiles.length === 0) {
        throw new Error('Nenhum arquivo de áudio encontrado para renderização');
      }

      if (imageFiles.length === 0) {
        throw new Error('Nenhuma imagem encontrada para renderização');
      }

      console.log(`📊 Encontrados ${audioFiles.length} áudios e ${imageFiles.length} imagens`);

      // Verificar se temos imagens suficientes (2 imagens por áudio)
      const requiredImages = audioFiles.length * 2;
      if (imageFiles.length < requiredImages) {
        console.warn(`⚠️ Aviso: Temos ${imageFiles.length} imagens, mas precisamos de ${requiredImages} (2 por áudio)`);
        console.log(`Algumas imagens serão reutilizadas...`);
      }

      // Criar lista de inputs para FFmpeg - 2 imagens por áudio
      const videoSegments: string[] = [];

      for (let i = 0; i < audioFiles.length; i++) {
        const audioFile = audioFiles[i];
        
        // Verificar se arquivo de áudio existe
        try {
          await fs.access(audioFile);
        } catch (error) {
          console.error(`❌ Arquivo de áudio não encontrado: ${audioFile}`);
          continue;
        }
        
        // Usar 2 imagens para este áudio
        const image1Index = (i * 2) % imageFiles.length;
        const image2Index = (i * 2 + 1) % imageFiles.length;
        
        const image1 = imageFiles[image1Index];
        const image2 = imageFiles[image2Index];
        
        // Verificar se arquivos de imagem existem
        try {
          await fs.access(image1);
          await fs.access(image2);
        } catch (error) {
          console.error(`❌ Arquivo de imagem não encontrado: ${error.message}`);
          continue;
        }
        
        console.log(`🎥 Criando segmento ${i + 1}/${audioFiles.length} (2 imagens por áudio)...`);
        console.log(`   📸 Imagem 1: ${path.basename(image1)}`);
        console.log(`   📸 Imagem 2: ${path.basename(image2)}`);
        console.log(`   🎵 Áudio: ${path.basename(audioFile)}`);

        // Criar dois sub-segmentos: primeira metade e segunda metade do áudio
        const segment1Output = path.join(outputDir, `segment_${i + 1}_part1.mp4`);
        const segment2Output = path.join(outputDir, `segment_${i + 1}_part2.mp4`);
        
        // Obter duração do áudio
        console.log(`📊 Obtendo duração do áudio: ${path.basename(audioFile)}`);
        let totalDuration = 10; // Padrão
        let halfDuration = 5;   // Padrão
        
        try {
          const durationCommand = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${audioFile}"`;
          console.log(`🔍 Executando comando: ${durationCommand}`);
          const durationResult = await execAsync(durationCommand, { maxBuffer: 1024 * 1024 * 10, timeout: 30000 }); // 30s timeout
          totalDuration = parseFloat(durationResult.stdout.trim());
          halfDuration = totalDuration / 2;
          console.log(`⏱️ Duração total: ${totalDuration}s, metade: ${halfDuration}s`);
        } catch (durationError) {
          console.error(`❌ Erro ao obter duração do áudio:`, durationError.message);
          console.log(`⚠️ Usando duração padrão: ${totalDuration}s`);
        }
        
        // Primeira metade: primeira imagem + primeira metade do áudio
        console.log(`🎬 Criando primeira parte do segmento...`);
        const ffmpegCommand1 = `ffmpeg -y -v error -loop 1 -i "${image1}" -i "${audioFile}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -t ${halfDuration} "${segment1Output}"`;
        
        try {
          await execAsync(ffmpegCommand1, { maxBuffer: 1024 * 1024 * 10, timeout: 60000 }); // 60s timeout
          console.log(`✅ Primeira parte criada: ${path.basename(segment1Output)}`);
        } catch (ffmpegError1) {
          console.error(`❌ Erro na primeira parte:`, ffmpegError1.message);
          throw ffmpegError1;
        }
        
        // Segunda metade: segunda imagem + segunda metade do áudio  
        console.log(`🎬 Criando segunda parte do segmento...`);
        const ffmpegCommand2 = `ffmpeg -y -v error -loop 1 -i "${image2}" -ss ${halfDuration} -i "${audioFile}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -t ${halfDuration} "${segment2Output}"`;
        
        try {
          await execAsync(ffmpegCommand2, { maxBuffer: 1024 * 1024 * 10, timeout: 60000 }); // 60s timeout
          console.log(`✅ Segunda parte criada: ${path.basename(segment2Output)}`);
        } catch (ffmpegError2) {
          console.error(`❌ Erro na segunda parte:`, ffmpegError2.message);
          throw ffmpegError2;
        }
        
        videoSegments.push(segment1Output);
        videoSegments.push(segment2Output);
        console.log(`✅ Segmento ${i + 1} criado em 2 partes (${halfDuration.toFixed(1)}s cada): ${path.basename(segment1Output)}, ${path.basename(segment2Output)}`);
      }

      // Criar arquivo de lista para concatenação
      const listFile = path.join(outputDir, 'segments_list.txt');
      const listContent = videoSegments.map(segment => `file '${segment}'`).join('\n');
      await fs.writeFile(listFile, listContent, 'utf-8');

      // Concatenar todos os segmentos
      let videoFileName = 'video_final.mp4';
      if (filePath) {
        const fileName = path.basename(filePath, path.extname(filePath));
        const cleanTitle = this.cleanTitleFromFilename(fileName);
        if (cleanTitle) {
          videoFileName = `${cleanTitle}.mp4`;
        }
      }
      
      const finalOutput = path.join(outputDir, videoFileName);
      const concatCommand = `ffmpeg -y -v error -f concat -safe 0 -i "${listFile}" -c copy "${finalOutput}"`;
      
      console.log('🔗 Concatenando segmentos...');
      await execAsync(concatCommand, { maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer

      // Limpar arquivos temporários
      console.log('🧹 Limpando arquivos temporários...');
      for (const segment of videoSegments) {
        try {
          await fs.unlink(segment);
        } catch (error) {
          console.warn(`Aviso: Não foi possível deletar ${segment}`);
        }
      }
      
      try {
        await fs.unlink(listFile);
      } catch (error) {
        console.warn('Aviso: Não foi possível deletar o arquivo de lista');
      }

      console.log(`🎉 Vídeo renderizado com sucesso: ${finalOutput}`);
      return finalOutput;

    } catch (error) {
      console.error('❌ Erro durante a renderização:', error.message);
      throw error;
    }
  }

  private async getAudioFiles(outputDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(outputDir);
      const audioFiles = files
        .filter(file => file.startsWith('output_audio_') && file.endsWith('.wav'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/output_audio_(\d+)\.wav/)?.[1] || '0');
          const bNum = parseInt(b.match(/output_audio_(\d+)\.wav/)?.[1] || '0');
          return aNum - bNum;
        })
        .map(file => path.join(outputDir, file));
      
      return audioFiles;
    } catch (error) {
      console.error('Erro ao buscar arquivos de áudio:', error);
      return [];
    }
  }

  private async getImageFiles(outputDir: string): Promise<string[]> {
    try {
      const files = await fs.readdir(outputDir);
      const imageFiles = files
        .filter(file => file.startsWith('imagem_') && file.endsWith('.jpg'))
        .sort((a, b) => {
          const aNum = parseInt(a.match(/imagem_(\d+)\.jpg/)?.[1] || '0');
          const bNum = parseInt(b.match(/imagem_(\d+)\.jpg/)?.[1] || '0');
          return aNum - bNum;
        })
        .map(file => path.join(outputDir, file));
      
      return imageFiles;
    } catch (error) {
      console.error('Erro ao buscar arquivos de imagem:', error);
      return [];
    }
  }

  async renderExistingFiles(outputDir: string): Promise<string> {
    console.log(`\n🎬 Renderizando vídeo a partir dos arquivos existentes em: ${outputDir}`);
    return await this.renderVideoWithFFmpeg(outputDir);
  }

  async retryVideoRendering(folderPath: string): Promise<string> {
    const retryTimer = new Timer('Retry renderização de vídeo');
    retryTimer.logStart();
    
    try {
      retryTimer.log(`🔄 Tentando renderizar vídeo novamente em: ${folderPath}`);
      
      // Verificar se a pasta existe
      try {
        await fs.access(folderPath);
      } catch (error) {
        throw new Error(`Pasta não encontrada: ${folderPath}`);
      }
      
      // Verificar se temos arquivos de áudio e imagem
      const audioFiles = await this.getAudioFiles(folderPath);
      const imageFiles = await this.getImageFiles(folderPath);
      
      if (audioFiles.length === 0) {
        throw new Error(`Nenhum arquivo de áudio encontrado em: ${folderPath}`);
      }
      
      if (imageFiles.length === 0) {
        throw new Error(`Nenhuma imagem encontrada em: ${folderPath}`);
      }
      
      retryTimer.log(`📊 Encontrados ${audioFiles.length} áudios e ${imageFiles.length} imagens`);
      retryTimer.log(`🎬 Iniciando renderização do vídeo...`);
      
      // Renderizar o vídeo
      const videoPath = await this.renderVideoWithFFmpeg(folderPath);
      
      retryTimer.logEnd();
      retryTimer.log(`✅ Vídeo renderizado com sucesso: ${videoPath}`);
      console.log(`\n🎯 TEMPO TOTAL DE RENDERIZAÇÃO: ${retryTimer.getElapsedTime()}`);
      
      // Tocar som de notificação quando a renderização terminar
      this.playNotificationSound();
      console.log('🔔 Renderização concluída! Som de notificação emitido.');
      
      return videoPath;
      
    } catch (error) {
      retryTimer.log(`❌ Erro ao renderizar vídeo: ${error.message}`);
      throw error;
    }
  }
}