# Liquid Templating for VSCode

**Liquid Templating** is a Visual Studio Code extension that allows you to render templates using the [Liquid](https://shopify.github.io/liquid/) templating engine and JSON-based data sources. It also supports dynamic data generation using JavaScript and integration with Microsoft SQL Server.

![Demo](https://raw.githubusercontent.com/hafizhanwafi/liquid-templating/refs/heads/main/media/demo.gif)


## Features

- Render `.liquid-template.*` files using data from `.liquid-data.json`.
- Define your data statically or dynamically using a generator script.
- Fetch data from SQL Server databases using a JavaScript data source file (`*.liquid-data-src.js`).
- Integrated CodeLens for easy actions:
  - ▶ Render: Render your template to the output file.
  - ▶ Fetch: Fetch data from the database and update the JSON data.
  - ▶ Watch: Watch for file changes and automatically re-render.
- **Live Preview**: View rendered templates in real-time as you edit your data or template.

## Commands

The following commands are available in the extension:

- `Liquid Templating: Render`: Render the template to the output file.
- `Liquid Templating: Render and Watch`: Render the template and watch for changes to automatically re-render.

## Getting Started

1. Create a `.liquid-template.*` file as your template.
2. Create a `.liquid-data.json` file to define:
   ```json
   {
     "template": "./your-template.liquid-template.txt",
     "output": "./output.txt",
     "data": {},
     "dataGenerator": {
       "src": "./your-generator.liquid-data-src.js"
     }
   }
