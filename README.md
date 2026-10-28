# Asked

**Free AEO And GEO Question Finder For B2B Content**

Enter a keyword and *Asked* shows the questions AI search will ask about it, along with the evidence that makes each one worth answering, then shapes them into a content brief your writers can use the same day.

Live site: https://archanacontent.github.io/asked/

## Why It Exists

AI search engines rarely answer a buyer's question by searching for it directly. Google AI Mode breaks a question into sub-queries and cites whichever pages answer each part, and many of those sub-queries show no volume in traditional keyword tools. Content teams end up guessing at FAQ sections and long-tail phrases. *Asked* replaces the guesswork with a published, testable method.

## What It Does

- **Gathers Search Demand** - questions people type into Google and Bing autocomplete around the keyword.
- **Predicts Fan-Out** - the sub-questions an answer engine is likely to run, following the B2B evaluation path: fit and function, cost, security and compliance, integration and rollout, alternatives and trade-offs, proof and outcomes.
- **Labels Every Question** - Confirmed, Search Demand or Predicted Fan-Out, so writers can see why each question is there.
- **Builds The Brief** - ranked questions, answer formats, facts and entities to include and a suggested outline, ready to copy into Google Docs or download as Markdown.
- **Checks The Predictions** - compares a published brief with Bing Webmaster Tools and Google Search Console AI data.

## How It Stays Free

Everything runs in the visitor's browser on GitHub Pages. There is no server, no signup and no tracking. The built-in engine applies the published facet patterns directly. Visitors who want deeper predictions can add their own free Gemini API key, which is stored only in their browser and sent only to Google.

## The Method

- [The Asked Method](https://archanacontent.github.io/asked/method/)
- [The Citable Passage Standard](https://archanacontent.github.io/asked/standard/)

## Project Structure

| Path | Purpose |
| :--- | :--- |
| `index.html` | Homepage |
| `method/`, `standard/` | The published method and writing standard |
| `results/`, `brief/`, `check/` | The tool screens |
| `assets/js/engine.js` | The question engine that implements the method |
| `tour/tours.json` | Copy and targeting for both onboarding tours |

## Licences

- Code: [GNU AGPL-3.0](LICENSE)
- Method, standard and site copy: [CC BY-NC 4.0](LICENSE-METHOD.md)

## Citation

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.23732497.svg)](https://doi.org/10.5281/zenodo.23732497)

Panda, A. (2026). *The Asked Method: Evidence-Backed Question Planning For AI Search.* https://doi.org/10.5281/zenodo.23732497

See [CITATION.cff](CITATION.cff) for citation metadata.

## Author

Designed, written and maintained by [Archana Panda](https://archanacontent.github.io), Senior Technical Content Writer and Strategist.

*Asked* is an independent project and is not affiliated with Google or Microsoft.
