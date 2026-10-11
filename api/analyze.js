   export default async function handler(req, res) {
     // Разрешаем запросы из Тильды (CORS)
     if (req.method === 'OPTIONS') {
       return res.status(200).end();
     }

     if (req.method !== 'POST') {
       return res.status(405).json({ error: 'Method not allowed' });
     }

     const headers = {
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*',
     };

     try {
       const { idea } = req.body;

       // Валидация: оставляем только буквы и пробелы
       const lettersOnly = (idea || '').replace(/[^а-яА-Яa-zA-Z\s]/g, '').trim();
       const letterCount = lettersOnly.replace(/\s/g, '').length;
       const words = lettersOnly.split(/\s+/).filter(w => w.length > 0);

       if (!idea || !idea.trim()) {
         return res.status(400).json({ error: 'Опишите участок, описание отсутствует' });
       }
       if (letterCount < 10) {
         return res.status(400).json({ error: 'Опишите участок подробнее. Описание слишком короткое или состоит из символов/цифр' });
       }
       if (words.length < 3) {
         return res.status(400).json({ error: 'Опишите участок словами. Нужно минимум 3 осмысленных слова' });
       }

       // Запрос к DeepSeek
       const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
         method: 'POST',
         headers: {
           'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
           'Content-Type': 'application/json',
         },
         body: JSON.stringify({
           model: 'deepseek-chat',
           messages: [
             {
               role: 'system',
               content: 'Ты профессиональный ландшафтный дизайнер с 20-летним опытом. Проанализируй описание участка и верни СТРОГО JSON без markdown, без пояснений. Структура: {"strengths": ["..."], "weaknesses": ["..."], "questions": ["..."]}. Каждый массив содержит 3-5 конкретных пунктов.'
             },
             {
               role: 'user',
               content: `Описание участка: ${idea}`
             }
           ],
           temperature: 0.5,
           max_tokens: 1200,
         }),
       });

       if (!response.ok) {
         return res.status(response.status).json({ error: 'Ошибка сервиса анализа. Попробуйте позже.' });
       }

       const data = await response.json();
       let rawText = data.choices[0].message.content;

       // Чистим ответ от возможных markdown-оберток (```json)
       let cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
       
       let parsed;
       try {
         parsed = JSON.parse(cleanJson);
       } catch (e) {
         return res.status(500).json({ error: 'Сервис вернул некорректный формат данных' });
       }

       return res.status(200).json(parsed);

     } catch (error) {
       return res.status(500).json({ error: `Ошибка: ${error.message}` });
     }
   }
