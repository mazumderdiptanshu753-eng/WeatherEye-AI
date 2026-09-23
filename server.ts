import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Gemini client if API key is present
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

interface AnomalyEvent {
  id: string;
  name: string;
  type: 'Cyclone' | 'Heat Dome' | 'Cold Wave' | 'Cloudburst';
  region: string;
  coordinates: { lat: number; lng: number };
  forecastHorizon: string; // e.g. "Day 5 (120h)"
  efiScore: number; // Extreme Forecast Index standard deviations
  coarseResolution: string; // "12 km (NEPS-G)"
  downscaledResolution: string; // "5 km (Diffusion Core)"
  peakWindSpeed: string; // e.g. "215 km/h"
  peakRainfall: string; // e.g. "185 mm/3h"
  status: 'Active Tracking' | 'High Risk' | 'Landfall Imminent' | 'Dissipating';
  trajectory: Array<{ day: number; lat: number; lng: number; intensity: string }>;
  physicsLossPenalty: number; // e.g. 0.012
}

const INITIAL_ANOMALIES: AnomalyEvent[] = [
  {
    id: 'cyclone-amphan-sim',
    name: 'Bay of Bengal Super Cyclone (Amphan Vector)',
    type: 'Cyclone',
    region: 'Eastern Coastal India & Bangladesh',
    coordinates: { lat: 18.2, lng: 87.5 },
    forecastHorizon: 'Day 4 (96h Forecast)',
    efiScore: 4.82,
    coarseResolution: '12 km (NEPS-G Ensemble)',
    downscaledResolution: '5 km (Amplitude-Preserving Diffusion)',
    peakWindSpeed: '240 km/h (Gusts to 265)',
    peakRainfall: '220 mm / 3h',
    status: 'High Risk',
    trajectory: [
      { day: 1, lat: 13.5, lng: 86.2, intensity: 'Depression' },
      { day: 2, lat: 15.1, lng: 86.8, intensity: 'Severe Cyclonic Storm' },
      { day: 3, lat: 16.8, lng: 87.1, intensity: 'Very Severe' },
      { day: 4, lat: 18.2, lng: 87.5, intensity: 'Super Cyclone (Peak)' },
      { day: 5, lat: 21.4, lng: 88.3, intensity: 'Landfall Corridor' },
    ],
    physicsLossPenalty: 0.0042,
  },
  {
    id: 'nw-heat-dome',
    name: 'Northwest India Thermal Heat Dome',
    type: 'Heat Dome',
    region: 'Rajasthan, Punjab & Haryana',
    coordinates: { lat: 28.1, lng: 73.8 },
    forecastHorizon: 'Day 6 (144h Forecast)',
    efiScore: 3.95,
    coarseResolution: '12 km (NEPS-G Ensemble)',
    downscaledResolution: '5 km (Topography-Coupled Diffusion)',
    peakWindSpeed: '18 km/h (Stagnant Air)',
    peakRainfall: '0 mm (Extreme Dry Bulb)',
    status: 'Active Tracking',
    trajectory: [
      { day: 1, lat: 26.5, lng: 71.0, intensity: '42°C Baseline' },
      { day: 3, lat: 27.2, lng: 72.4, intensity: '45°C Ridge' },
      { day: 5, lat: 28.1, lng: 73.8, intensity: '48.5°C Thermal Peak' },
      { day: 7, lat: 28.8, lng: 75.0, intensity: 'Persistent Dome' },
    ],
    physicsLossPenalty: 0.0089,
  },
  {
    id: 'himalayan-cloudburst',
    name: 'Himachal-Uttarakhand Orographic Cloudburst',
    type: 'Cloudburst',
    region: 'Western Himalayas (Kullu/Chamoli)',
    coordinates: { lat: 31.9, lng: 77.1 },
    forecastHorizon: 'Day 3 (72h Forecast)',
    efiScore: 5.12,
    coarseResolution: '12 km (NEPS-G Ensemble)',
    downscaledResolution: '5 km (Thermodynamic Subgrid)',
    peakWindSpeed: '65 km/h (Orographic Shear)',
    peakRainfall: '310 mm / 2h',
    status: 'Landfall Imminent',
    trajectory: [
      { day: 1, lat: 30.8, lng: 76.2, intensity: 'Low-Level Moist Convergence' },
      { day: 2, lat: 31.4, lng: 76.8, intensity: 'Rapid Updraft Channel' },
      { day: 3, lat: 31.9, lng: 77.1, intensity: 'Catastrophic Orographic Core' },
    ],
    physicsLossPenalty: 0.0018,
  },
  {
    id: 'arabian-sea-depression',
    name: 'Arabian Sea Rapid Intensification Vortex',
    type: 'Cyclone',
    region: 'Konkan & Gujarat Coastline',
    coordinates: { lat: 19.5, lng: 68.2 },
    forecastHorizon: 'Day 5 (120h Forecast)',
    efiScore: 4.21,
    coarseResolution: '12 km (NEPS-G Ensemble)',
    downscaledResolution: '5 km (Diffusion Downscaler)',
    peakWindSpeed: '175 km/h',
    peakRainfall: '140 mm / 3h',
    status: 'Active Tracking',
    trajectory: [
      { day: 1, lat: 16.0, lng: 70.5, intensity: 'Warm Pool Convection' },
      { day: 3, lat: 17.8, lng: 69.2, intensity: 'Cyclonic Organization' },
      { day: 5, lat: 19.5, lng: 68.2, intensity: 'Intense Vortex Core' },
    ],
    physicsLossPenalty: 0.0055,
  }
];

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'online', system: 'AeroMesh AI GNN & Diffusion Pipeline', timestamp: new Date().toISOString() });
  });

  app.get('/api/anomalies', (req, res) => {
    res.json({ success: true, count: INITIAL_ANOMALIES.length, data: INITIAL_ANOMALIES });
  });

  app.post('/api/downscale', (req, res) => {
    const { anomalyId, diffusionSteps = 50, physicsWeight = 0.85 } = req.body;
    const anomaly = INITIAL_ANOMALIES.find(a => a.id === anomalyId) || INITIAL_ANOMALIES[0];

    // Simulate diffusion generation output comparing coarse 12km vs downscaled 5km
    const gridPoints = 25; // 5x5 subgrid matrix
    const subgridValues = [];
    const baseVal = anomaly.type === 'Cyclone' ? 220 : anomaly.type === 'Heat Dome' ? 48 : 300;

    for (let i = 0; i < gridPoints; i++) {
      const distanceFactor = Math.abs(12 - i) / 12;
      const amplified = Math.round((baseVal * (1 - distanceFactor * 0.4) + (Math.random() * 15 - 7.5)) * 10) / 10;
      const coarseSmoothed = Math.round((baseVal * (1 - distanceFactor * 0.4) * 0.82) * 10) / 10;
      subgridValues.push({
        index: i,
        latOffset: (Math.floor(i / 5) - 2) * 0.045,
        lngOffset: ((i % 5) - 2) * 0.045,
        coarse12kmValue: coarseSmoothed,
        diffusion5kmValue: Math.max(amplified, coarseSmoothed),
        amplitudeGain: Math.round(((amplified - coarseSmoothed) / coarseSmoothed) * 100),
      });
    }

    res.json({
      success: true,
      anomalyId: anomaly.id,
      anomalyName: anomaly.name,
      parameters: { diffusionSteps, physicsWeight },
      metrics: {
        spectralSmoothingReduction: '94.2%',
        peakAmplitudeRetention: '98.7%',
        navierStokesDivergenceScore: '0.0014 (Within Physical Limit)',
        thermodynamicConsistency: '99.1%',
        processingTimeMs: 412,
      },
      subgridMatrix: subgridValues,
    });
  });

  app.post('/api/alerts', (req, res) => {
    const { anomalyId, radiusKm = 5, targetAudience = 'ndrf' } = req.body;
    const anomaly = INITIAL_ANOMALIES.find(a => a.id === anomalyId) || INITIAL_ANOMALIES[0];

    const severity = anomaly.efiScore > 4.5 ? 'SEVERE' : anomaly.efiScore > 4.0 ? 'MODERATE' : 'ELEVATED';

    const ndrfDirectives = [
      'Position swift water rescue boats at 2km grid intersections along coastal drainage.',
      'Evacuate low-lying temporary settlements within the 5km impact zone before T-minus 12 hours.',
      'Deploy emergency comms repeaters on elevated terrain to bypass cellular blackout.',
      'Pre-position heavy earth-moving machinery to clear anticipated landslide bottlenecks.'
    ];

    const agriDirectives = [
      'Install UV-stabilized anti-hail protective netting across standing horticultural crops.',
      'Clear perimeter irrigation channels to facilitate rapid drainage of 200mm+ flash precipitation.',
      'Harvest mature grain crops immediately to prevent lodging and moisture sprouting.',
      'Deploy micro-irrigation misting systems to mitigate thermal stress during peak heat dome hours.'
    ];

    res.json({
      success: true,
      alertId: `ALERT-${Math.floor(100000 + Math.random() * 900000)}`,
      timestamp: new Date().toISOString(),
      targetAnomaly: anomaly.name,
      epicenter: anomaly.coordinates,
      impactRadiusKm: radiusKm,
      severityCategory: severity,
      efiScore: anomaly.efiScore,
      targetAudience: targetAudience.toUpperCase(),
      directives: targetAudience === 'ndrf' ? ndrfDirectives : agriDirectives,
      spatialPolygon: [
        { lat: anomaly.coordinates.lat + 0.045, lng: anomaly.coordinates.lng - 0.045 },
        { lat: anomaly.coordinates.lat + 0.045, lng: anomaly.coordinates.lng + 0.045 },
        { lat: anomaly.coordinates.lat - 0.045, lng: anomaly.coordinates.lng + 0.045 },
        { lat: anomaly.coordinates.lat - 0.045, lng: anomaly.coordinates.lng - 0.045 },
      ],
      disseminationStatus: 'Broadcast Ready (API Dispatched to 1,420 Subgrid Nodes)'
    });
  });

  app.post('/api/ai-advisory', async (req, res) => {
    const { anomalyId } = req.body;
    const anomaly = INITIAL_ANOMALIES.find(a => a.id === anomalyId) || INITIAL_ANOMALIES[0];

    if (!ai) {
      // Fallback if no Gemini API key
      return res.json({
        success: true,
        source: 'fallback',
        advisory: `[AeroMesh AI Meteorological Advisory]\n\nAnomaly: ${anomaly.name}\nType: ${anomaly.type}\nRegion: ${anomaly.region}\nEFI Score: ${anomaly.efiScore} (Extreme anomaly threshold exceeded).\n\nSpherical GNN 4D Trajectory Analysis indicates rapid intensification over the next ${anomaly.forecastHorizon}. Diffusion downscaling (5km grid) confirms peak wind speeds of ${anomaly.peakWindSpeed} and precipitation rates of ${anomaly.peakRainfall}.\n\nRecommended Action: Immediate activation of high-resolution 5km localized alerts. Pre-position disaster response assets within the core radius.`
      });
    }

    try {
      const model = ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are AeroMesh AI, an elite meteorological and atmospheric physics AI engine. Generate a concise, highly professional meteorological briefing and tactical impact advisory for the following extreme weather anomaly tracked by our Spatio-Temporal GNN & Diffusion Downscaling Pipeline:

Event Name: ${anomaly.name}
Type: ${anomaly.type}
Region: ${anomaly.region}
Forecast Horizon: ${anomaly.forecastHorizon}
Extreme Forecast Index (EFI): ${anomaly.efiScore}
Coarse Input: ${anomaly.coarseResolution}
Downscaled Output: ${anomaly.downscaledResolution}
Peak Amplitude Parameters: Wind ${anomaly.peakWindSpeed}, Rainfall ${anomaly.peakRainfall}
Status: ${anomaly.status}

Provide:
1. Synoptic Situation & GNN Trajectory Outlook
2. Diffusion Downscaling Peak Amplitude Insights (Why spectral smoothing was avoided)
3. 5km Hyper-Localized Impact Assessment
4. Actionable Directives for First Responders (NDRF) and Rural Agriculture

Format with clean Markdown headers and bullet points.`
      });

      const response = await model;
      res.json({
        success: true,
        source: 'gemini-2.5-flash',
        advisory: response.text
      });
    } catch (error: any) {
      console.error('Gemini API error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to generate AI advisory' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`AeroMesh AI Server running on http://localhost:${port}`);
  });
}

startServer();
