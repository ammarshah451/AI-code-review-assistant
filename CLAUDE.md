# CodeGuard AI - Development Plan

## Project Overview

CodeGuard AI is a multi-agent system that acts as a first-pass reviewer for GitHub pull requests. It analyzes Python code for logic errors, security vulnerabilities, and code quality issues, then posts findings as a PR comment.

## Tech Stack

- **Backend:** FastAPI, LangGraph, Pydantic, PostgreSQL (Supabase), Redis (Upstash)
- **Frontend:** React + Vite + TypeScript
- **LLM:** Gemini 2.0 Flash (free tier) for development, option to switch to GPT-4o/Claude later
- **Monitoring:** LangSmith for tracing and evaluation
- **Deployment:** Vercel (frontend), Railway (backend), Supabase (database), Upstash (redis)

## Architecture
```
GitHub Webhook (PR Created/Updated)
            │
            ▼
      FastAPI Backend
            │
            ▼
      Supervisor Agent
            │
            ▼
   ┌────────┼────────┐
   ▼        ▼        ▼
Logic   Security  Quality
Agent    Agent    Agent
   └────────┼────────┘
            ▼
      Critique Loop
  (Security reviews Logic fixes)
            │
            ▼
    GitHub PR Comment
