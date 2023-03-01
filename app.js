import axios from "axios";
import cheerio from "cheerio";
import express from "express";
import https from "https";
import pdfjsLib from "pdfjs-dist";
import * as dotenv from 'dotenv'
dotenv.config()

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const port = process.env.PORT || 3000;


async function loadPdf(url) {
  const loadingTask = pdfjsLib.getDocument({
    url: url,
    httpHeaders: {
      Range: "bytes=0-1000000",
    },
    nativeImageDecoderSupport: "none",
    httpOptions: {
      agent: new https.Agent({
        rejectUnauthorized: false,
      }),
    },
  });

  const pdfDocument = await loadingTask.promise;
  const pagePromises = [];

  for (let i = 1; i <= pdfDocument.numPages; i++) {
    const page = await pdfDocument.getPage(i);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((item) => item.str).join("");
    const matches = text.match(/https?:\/\/\S+/gi);
    if (matches) {
      const processedMatches = matches.map((match) => match.replace(/•/g, ""));
      pagePromises.push(Promise.resolve(processedMatches));
    }
  }

  return Promise.all(pagePromises);
}

const app = express();
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
});

app.get("/", async (req, res) => {
  try {
    const response = await axios.get(
      process.env.URL,
      {
        httpsAgent: httpsAgent,
      }
    );

    const html = response.data;
    const $ = cheerio.load(html);
    const link = $("a.link").first().attr("href");
    const pages = await loadPdf(link);

    res.json({ success: true, data: pages[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(port, () => console.log("Server started on port", port));
