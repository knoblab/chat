# Knoblab Chat

Knoblab Chat is an end-to-end encrypted web messenger built on the Matrix protocol. It provides a secure communication platform utilizing decentralized infrastructure.

## Technical Stack

* Framework: React
* Language: TypeScript
* Build Tool: Vite
* State Management: Zustand
* Routing: React Router
* Matrix SDK: matrix-js-sdk

## Installation and Setup

### Prerequisites
* Node.js (v18 or higher recommended)
* npm

### Development Server

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables (if applicable):
   ```bash
   cp .env.example .env
   ```

3. Start the local development server:
   ```bash
   npm run dev
   ```

### Build for Production

To build the application for production, run:
```bash
npm run build
```
The output will be generated in the `dist` directory.

## Acknowledgments and Licensing

This project interacts with the Matrix protocol using the [matrix-js-sdk](https://github.com/matrix-org/matrix-js-sdk).

* Matrix and `matrix-js-sdk` are provided by The Matrix.org Foundation C.I.C.
* `matrix-js-sdk` is licensed under the Apache License, Version 2.0.
* A copy of the Apache 2.0 License can be obtained at: http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
