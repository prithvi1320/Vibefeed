# VibeFeed

Production-ready full-stack news platform with regional sentiment classification.

## Stack
- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js + Express.js
- Database: MongoDB
- Live Data: NewsAPI

## Features
- Newspaper-style layout with serif headlines
- Top nav: Home, Positive, Negative, Neutral, region selector
- Breaking news ticker
- Search bar + region filter
- Sentiment sections and badges
- Real-time like/dislike voting
- Sentiment auto-calculation:
  - likes > dislikes => positive
  - dislikes > likes => negative
  - equal => neutral
- Loading and error UI states
- Mobile responsive design
- Environment-based secrets

## API Endpoints
- `GET /api/news`
- `GET /api/news/:sentiment`
- `GET /api/news/region/:region`
- `POST /api/vote`

