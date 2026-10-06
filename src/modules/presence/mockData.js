export const CATEGORIES = [
  'SOCIAL', 'SEARCH', 'LOCAL', 'AI', 'REVIEWS', 'DIRECTORIES', 'MARKETPLACES'
];

export const STATUSES = {
  OPTIMIZED: { id: 'OPTIMIZED', color: '#10b981', label: 'Optimized' },
  CONNECTED: { id: 'CONNECTED', color: '#3b82f6', label: 'Connected' },
  DETECTED:  { id: 'DETECTED',  color: '#6366f1', label: 'Detected' },
  ISSUE:     { id: 'ISSUE',     color: '#f59e0b', label: 'Issue' },
  MISSING:   { id: 'MISSING',   color: '#ef4444', label: 'Missing' },
  OPPORTUNITY:{id: 'OPPORTUNITY',color: '#8b5cf6', label: 'Opportunity' }
};

export const PRIORITIES = {
  CRITICAL: 'Critical',
  HIGH: 'High',
  MEDIUM: 'Medium',
  MONITOR: 'Monitor'
};

export const MOCK_CHANNELS = [
  // SOCIAL
  { id: 'instagram', name: 'Instagram', category: 'SOCIAL', status: 'OPTIMIZED', priority: 'CRITICAL', score: 92 },
  { id: 'facebook', name: 'Facebook', category: 'SOCIAL', status: 'CONNECTED', priority: 'HIGH', score: 85 },
  { id: 'linkedin', name: 'LinkedIn', category: 'SOCIAL', status: 'OPPORTUNITY', priority: 'HIGH', score: 45, opportunityContext: 'Strong B2B real estate audience untapped.' },
  { id: 'tiktok', name: 'TikTok', category: 'SOCIAL', status: 'MISSING', priority: 'MEDIUM', score: 0 },
  { id: 'youtube', name: 'YouTube', category: 'SOCIAL', status: 'ISSUE', priority: 'HIGH', score: 30, issueContext: 'Inconsistent branding and outdated videos.' },
  { id: 'x', name: 'X', category: 'SOCIAL', status: 'DETECTED', priority: 'MONITOR', score: 20 },
  { id: 'threads', name: 'Threads', category: 'SOCIAL', status: 'MISSING', priority: 'MONITOR', score: 0 },
  { id: 'pinterest', name: 'Pinterest', category: 'SOCIAL', status: 'OPPORTUNITY', priority: 'MEDIUM', score: 10 },
  { id: 'reddit', name: 'Reddit', category: 'SOCIAL', status: 'DETECTED', priority: 'MONITOR', score: 15 },
  { id: 'bluesky', name: 'Bluesky', category: 'SOCIAL', status: 'MISSING', priority: 'MONITOR', score: 0 },

  // SEARCH
  { id: 'google', name: 'Google', category: 'SEARCH', status: 'OPTIMIZED', priority: 'CRITICAL', score: 95 },
  { id: 'bing', name: 'Bing', category: 'SEARCH', status: 'CONNECTED', priority: 'HIGH', score: 80 },
  { id: 'brave', name: 'Brave', category: 'SEARCH', status: 'DETECTED', priority: 'MEDIUM', score: 50 },
  { id: 'duckduckgo', name: 'DuckDuckGo', category: 'SEARCH', status: 'DETECTED', priority: 'MEDIUM', score: 55 },

  // LOCAL
  { id: 'google_maps', name: 'Google Maps', category: 'LOCAL', status: 'OPTIMIZED', priority: 'CRITICAL', score: 98 },
  { id: 'apple_maps', name: 'Apple Maps', category: 'LOCAL', status: 'ISSUE', priority: 'CRITICAL', score: 40, issueContext: 'Opening hours differ from master business data.', masterData: 'Mon-Fri 09:00-19:00', detectedData: 'Mon-Fri 10:00-18:00' },
  { id: 'bing_places', name: 'Bing Places', category: 'LOCAL', status: 'MISSING', priority: 'HIGH', score: 0 },
  { id: 'tomtom', name: 'TomTom', category: 'LOCAL', status: 'MISSING', priority: 'MEDIUM', score: 0 },
  { id: 'here', name: 'HERE', category: 'LOCAL', status: 'DETECTED', priority: 'MEDIUM', score: 30 },
  { id: 'waze', name: 'Waze', category: 'LOCAL', status: 'CONNECTED', priority: 'HIGH', score: 75 },
  { id: 'foursquare', name: 'Foursquare', category: 'LOCAL', status: 'ISSUE', priority: 'MEDIUM', score: 45 },

  // AI
  { id: 'chatgpt', name: 'ChatGPT', category: 'AI', status: 'OPPORTUNITY', priority: 'CRITICAL', score: 42, opportunityContext: 'ChatGPT mentions 3 competitors for strategic real-estate prompts where Nova Hábitat is absent.', stats: { prompts: 8, competitorMentions: 3, brandMentions: 0 } },
  { id: 'gemini', name: 'Gemini', category: 'AI', status: 'OPPORTUNITY', priority: 'CRITICAL', score: 35 },
  { id: 'google_ai', name: 'Google AI Overview', category: 'AI', status: 'DETECTED', priority: 'HIGH', score: 50 },
  { id: 'perplexity', name: 'Perplexity', category: 'AI', status: 'OPPORTUNITY', priority: 'HIGH', score: 25 },
  { id: 'claude', name: 'Claude', category: 'AI', status: 'MISSING', priority: 'MEDIUM', score: 0 },
  { id: 'copilot', name: 'Copilot', category: 'AI', status: 'DETECTED', priority: 'HIGH', score: 40 },
  { id: 'grok', name: 'Grok', category: 'AI', status: 'MISSING', priority: 'MONITOR', score: 0 },

  // REVIEWS
  { id: 'google_reviews', name: 'Google Reviews', category: 'REVIEWS', status: 'OPTIMIZED', priority: 'CRITICAL', score: 90 },
  { id: 'trustpilot', name: 'Trustpilot', category: 'REVIEWS', status: 'ISSUE', priority: 'HIGH', score: 60, issueContext: '2 unresolved negative reviews in the last 30 days.' },
  { id: 'tripadvisor', name: 'TripAdvisor', category: 'REVIEWS', status: 'MISSING', priority: 'MONITOR', score: 0 },
  { id: 'facebook_reviews', name: 'Facebook Reviews', category: 'REVIEWS', status: 'CONNECTED', priority: 'MEDIUM', score: 75 },

  // DIRECTORIES
  { id: 'paginas_amarillas', name: 'Páginas Amarillas', category: 'DIRECTORIES', status: 'DETECTED', priority: 'MEDIUM', score: 55 },
  { id: 'yelp', name: 'Yelp', category: 'DIRECTORIES', status: 'ISSUE', priority: 'MEDIUM', score: 40, issueContext: 'Phone number mismatch.' },
  { id: 'industry_dir', name: 'Real Estate Dir', category: 'DIRECTORIES', status: 'OPPORTUNITY', priority: 'HIGH', score: 20 },

  // MARKETPLACES
  { id: 'idealista', name: 'Idealista', category: 'MARKETPLACES', status: 'OPTIMIZED', priority: 'CRITICAL', score: 95 },
  { id: 'fotocasa', name: 'Fotocasa', category: 'MARKETPLACES', status: 'CONNECTED', priority: 'HIGH', score: 85 },
  { id: 'habitaclia', name: 'Habitaclia', category: 'MARKETPLACES', status: 'OPPORTUNITY', priority: 'HIGH', score: 40, opportunityContext: 'Missing high-quality property photos in 30% of listings.' },
  { id: 'pisos_com', name: 'pisos.com', category: 'MARKETPLACES', status: 'ISSUE', priority: 'MEDIUM', score: 50 }
];

export const SUMMARY_METRICS = {
  total: 42,
  active: 18,
  optimized: 9,
  missing: 7,
  inconsistent: 6,
  opportunities: 23
};

export const TOP_OPPORTUNITIES = [
  { id: 1, title: 'AI Visibility', subtitle: '+18 estimated visibility potential' },
  { id: 2, title: 'Missing Local Listings', subtitle: '3 high-value channels' },
  { id: 3, title: 'Brand Consistency', subtitle: '6 inconsistencies detected' }
];
