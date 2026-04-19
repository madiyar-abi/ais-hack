# Aqbobek International School — AI-Powered Internal Portal

An advanced web application to optimize the workflow of a modern international school. Built with Next.js, TailwindCSS, Supabase, and Gemini API.

## 🚀 Key Features

*   **Intelligent Schedule Engine (Ribbons Algorithm):** A robust algorithm that handles advanced multi-parallel constraints to automatically balance school schedules evenly throughout the week.
*   **AI Voice Assistant:** Integrates Gemini's STT (Speech-To-Text) and intelligence to let administrators dictate ad-hoc duties. The assistant understands the context, breaks the prompt into tasks, checks available staff in the database, and automatically issues assignments.
*   **Bureaucratic RAG Secretary:** An AI-powered knowledge base companion that translates informal requests into standard official school documents (e.g., mandates, statements, warnings) with Word document generation (`.doc` export) strictly formatted using GOST standards.
*   **Role-Based Dashboards:** Distinct environments based on user roles (Director, Teacher, Head Teacher, etc.), featuring robust Supabase-backed authentication.
*   **Teacher Replacements & Analytics:** Automatic recommendations for cover/substitute teachers and real-time incident report tracking.

## 🛠️ Technology Stack

*   **Frontend Framework:** [Next.js](https://nextjs.org/)
*   **Styling & UI:** [Tailwind CSS](https://tailwindcss.com/)
*   **Backend & Auth:** [Supabase](https://supabase.com/) (PostgreSQL + built-in authentication and real-time database functions)
*   **AI Engine:** [Google Gemini API](https://ai.google.dev/) (Flash models for text generation, speech analysis, and reasoning)
*   **Icons & Components:** Custom built "glassmorphic" interface optimized for accessibility.

## ⚙️ Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/madiyar-abi/ais-hack.git
    cd ais-hack
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env.local` file and structure it internally with the following:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    GEMINI_API_KEY=your_gemini_api_key
    ```
    
4.  **Run Development Server:**
    ```bash
    npm run dev
    ```

## 🔒 License

Proprietary — Aqbobek International School.
