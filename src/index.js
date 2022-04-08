import fastify from 'fastify';
import got from 'got';
import { Pool } from 'postgresql-client';
import { DataTypeOIDs } from 'postgresql-client';

function extractWords(questionTitle) {
  const words = questionTitle
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, '') //remove punctuation
    .replace(/\s{2,}/g, ' ') //remove extra spaces
    .split(' ')
    .filter((word) => word.length <= 4 && word.length >= 1);

  return [...new Set(words)];
}

function generateUrl(from, to, tags, page) {
  const partialUrl =
    'https://api.stackexchange.com/2.3/questions?&pagesize=100&site=stackoverflow';
  let url = '';
  if (tags) {
    url = `${partialUrl}&fromdate=${from}&todate=${to}&tagged=${tags}&page=${page}`;
  } else {
    url = `${partialUrl}&fromdate=${from}&todate=${to}&page=${page}`;
  }
  console.log(url);
  return url;
}

async function run() {
  const sql = new Pool({
    host: 'postgres://devUser:devPassword@localhost:35432/db',
    pool: {
      min: 1,
      max: 500,
      idleTimeoutMillis: 5000,
    },
  });

  //Create tables
  await sql.query(`
  CREATE TABLE IF NOT EXISTS questions (
      id INT PRIMARY KEY, 
      is_answered BOOL NOT NULL
      )`);

  await sql.query(`
  CREATE TABLE IF NOT EXISTS words (
    word VARCHAR(4) NOT NULL, 
    question_id INT,
    FOREIGN KEY (question_id) REFERENCES questions (id),
    PRIMARY KEY (question_id, word)
    )`);

  //Prepared statements
  const insertQuestionStatement = await sql.prepare(
    `INSERT INTO questions(id, is_answered) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING`,
    {
      paramTypes: [DataTypeOIDs.int4, DataTypeOIDs.bool],
    }
  );

  const insertWordStatement = await sql.prepare(
    'INSERT INTO words(word, question_id) VALUES ($1, $2) ON CONFLICT (word, question_id) DO NOTHING',
    {
      paramTypes: [DataTypeOIDs.varchar, DataTypeOIDs.int4],
    }
  );

  const server = fastify({ logger: { prettyPrint: true } });

  // Declare a route
  server.get('/', async (request, reply) => {
    console.log(request.params); // To get the params
    return { hello: 'world' };
  });

  server.post('/', async (request, reply) => {
    console.log(request.body); // To get the body
    return { hello: 'world' };
  });

  // load route
  server.post('/load', async (request, reply) => {
    const { from, to, tags } = request.query;
    let page = 1;
    let count = 0;
    let url = generateUrl(from, to, tags, page);

    let body;
    let questions = [];
    do {
      body = await got(url).json();
      if (!body.items.length) {
        return 0;
      }
      count += body.items.length;
      questions.push(...body.items);
      page += 1;
      url = generateUrl(from, to, tags, page);
    } while (body.has_more && page <= 24);

    const resultingPromises = questions.map(async (question) => {
      await insertQuestionStatement.execute({
        params: [question.question_id, question.is_answered],
      });

      await Promise.all(
        extractWords(question.title).map(async (word) => {
          await insertWordStatement.execute({
            params: [word, question.question_id],
          });
        })
      );
    });
    const results = await Promise.all(resultingPromises);

    return count;
  });

  // stats route
  server.get('/stats', async (request, reply) => {
    const { k } = request.query;

    const result = await sql.query(
      `SELECT 
        DISTINCT word, 
        COUNT (id) FILTER (WHERE is_answered = true ) as answered,
        COUNT (id) as total,
        GREATEST(0.0, count (id) - 5.0) *
        (1.0 / GREATEST(count (id) - 5.0, 1.0)) *
        ((1.0 * count (id) filter (where is_answered = true )) / (1.0 * count (id))) 
        as ratio
        FROM questions INNER JOIN words 
        ON questions.id = words.question_id 
        GROUP BY word
        ORDER BY (ratio) desc
        LIMIT $1
        `,
      { params: [parseInt(k)], fetchCount: k }
    );

    return result.rows;
  });

  try {
    await server.listen(3000);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

run();
