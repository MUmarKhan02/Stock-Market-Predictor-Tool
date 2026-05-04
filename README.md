# Market Predictor

A full-stack AI-powered stock and cryptocurrency market prediction platform built with React, Next.js, Supabase, and Claude AI.

## Overview

Market Predictor is an advanced application designed to predict stock and cryptocurrency market movements using machine learning and AI insights. It combines a custom-trained CNN+LSTM neural network with Claude AI integration to deliver investment intelligence, real-time alerts, and comprehensive portfolio analytics.

## Key Features

### AI-Powered Prediction Engine
- Custom CNN+LSTM Neural Network trained live in the browser
- Stock and cryptocurrency price forecasting
- Multiple prediction horizons: 1-week, 2-week, and 1-month ahead
- Real-time model training on historical market data
- Confidence intervals with probabilistic ranges

### Claude AI Chart Analysis
- Image-based chart analysis using Claude AI with OCR
- Advanced pattern recognition (head-and-shoulders, support/resistance, trends)
- AI-powered technical indicator interpretation
- Automatic candlestick and trend analysis

### Intelligent Investment Insights
- AI-generated investment recommendations per ticker
- Real-time news feed with AI-powered sentiment scoring
- Smart risk assessment and opportunity identification
- Historical pattern analysis and predictive insights

### Real-Time Price Alerts
- Instant notifications when prices reach target thresholds
- Live market price polling with millisecond updates
- Customizable alert thresholds and frequencies
- Background alert monitoring system

### Portfolio Risk Analytics
- Sharpe Ratio calculation for risk-adjusted returns
- Maximum Drawdown analysis for downside risk assessment
- Volatility metrics tracking and trend analysis
- AI-powered portfolio rebalancing suggestions
- Multi-asset allocation optimization

### Watchlist & Market Monitoring
- Live stock and cryptocurrency tracking
- Real-time price updates and 52-week range statistics
- Quick asset comparison and trend analysis
- Customizable watchlist organization

### Prediction Accuracy Tracking
- Automatic forecast resolution against real market prices
- Detailed prediction breakdown and performance history
- Historical accuracy metrics per ticker
- Model performance trending and validation

### Secure Authentication
- Google OAuth integration for seamless sign-in
- Email and password authentication via Supabase
- Secure session management and token handling
- User-specific data isolation and privacy

### User Experience
- Dark/Light mode toggle for comfortable viewing
- 20-currency display support with real-time conversion
- Mobile-responsive layout optimized for all device sizes
- Intuitive navigation and streamlined workflows
- Comprehensive prediction history with detailed breakdowns

## Technology Stack

- **Frontend**: React, Next.js, Recharts, JavaScript, CSS3
- **Backend**: Next.js API Routes, Node.js
- **Database & Auth**: Supabase (PostgreSQL, Authentication)
- **AI/ML**: Anthropic Claude API (Sonnet 4), Custom CNN+LSTM
- **Hosting**: Vercel
- **State Management**: React Context API

## Installation

### Prerequisites
- Node.js 16+ and npm/yarn
- Git for version control
- Modern web browser

### Quick Start

1. Clone the repository:
   ```bash
   git clone https://github.com/MUmarKhan02/Stock-Market-Predictor-Tool.git
   cd Stock-Market-Predictor-Tool
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create .env.local file in the project root:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Configuration & Setup

### 1. Anthropic API Key

- Cost: Paid - approximately $0.001-$0.01 per user action
- Setup Time: 5 minutes
- Steps:
  1. Go to https://console.anthropic.com
  2. Create an account or sign in
  3. Generate a new API key
  4. Add $5-$10 credits to your account
  5. Add the key to ANTHROPIC_API_KEY in .env.local

- Used for: Stock data fetching, news feed analysis, AI chart analysis, investment insights

### 2. Supabase Project

- Cost: Free tier available
- Setup Time: 5 minutes
- Steps:
  1. Visit https://supabase.com
  2. Create a new project
  3. Go to Project Settings > API
  4. Copy NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
  5. Add them to .env.local

### 3. Google Cloud OAuth

- Cost: Free tier available
- Setup Time: 10 minutes
- Steps:
  1. Visit https://console.cloud.google.com
  2. Create a new project
  3. Enable Google+ API
  4. Create OAuth 2.0 credentials for Web Application
  5. In Supabase, add Google provider with your credentials
  6. Add the Supabase callback URL to your Google Console authorized redirects

### 4. Vercel (Optional - for deployment)

- Cost: Free tier available
- Go to https://vercel.com
- Import your GitHub repository
- Add environment variables
- Deploy with one click

## Project Structure

```
market-predictor/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── claude/          # Claude AI integration
│   │   │   └── auth/            # Authentication callbacks
│   │   ├── globals.css
│   │   ├── layout.js
│   │   └── page.js
│   ├── components/
│   │   ├── App.jsx              # Main app component
│   │   ├── alerts/              # Price alert features
│   │   ├── auth/                # Authentication UI
│   │   ├── chartai/             # AI chart analysis
│   │   ├── history/             # Prediction history
│   │   ├── portfolio/           # Portfolio analytics
│   │   ├── predictor/           # Prediction interface
│   │   ├── shared/              # Reusable components
│   │   ├── tours/               # User onboarding
│   │   └── watchlist/           # Watchlist features
│   └── lib/
│       └── supabase.js          # Supabase client
├── public/                      # Static assets
├── package.json
├── next.config.mjs
├── jsconfig.json
└── README.md
```

## Deployment

### Deploy to Vercel

1. Push code to GitHub
2. Go to https://vercel.com
3. Click "New Project" and select your repository
4. Add environment variables from .env.local
5. Click Deploy

Your app will be live at a Vercel-provided URL (e.g., market-predictor.vercel.app)

### Important Notes:
- Add your production URLs to Google Cloud Console authorized redirects
- Update Supabase allowed URLs for Google OAuth
- Never commit .env.local to version control

## Cost Estimates

- Anthropic API: $5-$20/month (based on 10-50 API calls daily)
- Supabase: $0 (free tier includes authentication and database)
- Google Cloud: $0 (free tier is sufficient)
- Vercel: $0-$20/month (free tier available)
- Total: Approximately $5-$40/month

## Roadmap

### Current Status
Feature-complete at local development stage, not yet deployed to production

### Phase 2: Production Deployment
- Deploy to Vercel with production environment
- Implement API rate limiting for cost control
- Add monitoring and error tracking

### Phase 3: Monetization
- Freemium model with daily prediction limits
- Premium tier for unlimited AI features
- Enterprise tier for custom predictions and API access

### Phase 4: Cost Optimization
- Integrate Finnhub API for free market data
- Use Ollama or LM Studio for local LLM inference
- Build fully free, self-hosted version
- Docker containerization

### Phase 5: Real-Time Enhancements
- WebSocket integration for live price streaming
- Real-time push notifications
- Sub-second alert latency

### Phase 6: Social Features
- Share predictions with community
- Leaderboard for prediction accuracy tracking
- Social feed for following top predictors
- Trading signals marketplace

### Phase 7: Advanced Analytics
- Machine learning model performance dashboard
- Custom technical indicator builder
- Backtesting engine with historical simulation
- Risk simulation and stress testing

## Demo

A comprehensive demo video showcasing all features is coming soon!

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (git checkout -b feature/your-feature)
3. Make your changes and commit (git commit -m "Add feature description")
4. Push to your branch (git push origin feature/your-feature)
5. Open a Pull Request

## License

This project is licensed under the MIT License. See LICENSE file for details.

## Support

- Issues: https://github.com/MUmarKhan02/Stock-Market-Predictor-Tool/issues
- Discussions: https://github.com/MUmarKhan02/Stock-Market-Predictor-Tool/discussions

## Acknowledgments

- Anthropic for Claude AI API
- Supabase for authentication and database
- Next.js for the React framework
- Recharts for beautiful data visualization
- Vercel for hosting infrastructure

---

Built with effort by MUmarKhan02

Star this repository if you find it helpful!
