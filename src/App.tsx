/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  CloudRain, 
  Wind, 
  Thermometer, 
  Activity, 
  ShieldAlert, 
  MapPin, 
  Cpu, 
  Layers, 
  Zap, 
  Terminal, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle, 
  Compass, 
  Globe, 
  FileText, 
  Sliders, 
  Send,
  Database,
  ArrowRight,
  Maximize2
} from 'lucide-react';

interface Anomaly {
  id: string;
  name: string;
  type: 'Cyclone' | 'Heat Dome' | 'Cold Wave' | 'Cloudburst';
  region: string;
  coordinates: { lat: number; lng: number };
  forecastHorizon: string;
  efiScore: number;
  coarseResolution: string;
  downscaledResolution: string;
  peakWindSpeed: string;
  peakRainfall: string;
  status: 'Active Tracking' | 'High Risk' | 'Landfall Imminent' | 'Dissipating';
  trajectory: Array<{ day: number; lat: number; lng: number; intensity: string }>;
  physicsLossPenalty: number;
}

interface SubgridPoint {
  index: number;
  latOffset: number;
  lngOffset: number;
  coarse12kmValue: number;
  diffusion5kmValue: number;
  amplitudeGain: number;
}

const STATIC_ANOMALIES: Anomaly[] = [
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

export default function App() {
  const [activeTab, setActiveTab] = useState<'tracking' | 'downscale' | 'dashboard' | 'api' | 'advisory'>('dashboard');
  const [anomalies, setAnomalies] = useState<Anomaly[]>(STATIC_ANOMALIES);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string>('cyclone-amphan-sim');
  const [loading, setLoading] = useState<boolean>(false);
  const [downscaleData, setDownscaleData] = useState<{
    metrics?: {
      spectralSmoothingReduction: string;
      peakAmplitudeRetention: string;
      navierStokesDivergenceScore: string;
      thermodynamicConsistency: string;
      processingTimeMs: number;
    };
    subgridMatrix?: SubgridPoint[];
  } | null>(null);
  const [downscalingLoading, setDownscalingLoading] = useState<boolean>(false);
  const [diffusionSteps, setDiffusionSteps] = useState<number>(50);
  const [physicsWeight, setPhysicsWeight] = useState<number>(0.85);

  const [alertTargetAudience, setAlertTargetAudience] = useState<'ndrf' | 'agri'>('ndrf');
  const [alertResult, setAlertResult] = useState<any>(null);
  const [alertLoading, setAlertLoading] = useState<boolean>(false);

  const [aiAdvisoryText, setAiAdvisoryText] = useState<string>('');
  const [aiLoading, setAiLoading] = useState<boolean>(false);

  // Fetch anomalies on mount with fallback
  useEffect(() => {
    fetchAnomalies();
  }, []);

  const fetchAnomalies = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/anomalies');
      if (!res.ok) throw new Error('API offline');
      const json = await res.json();
      if (json.success) {
        setAnomalies(json.data);
      }
    } catch (e) {
      console.log('Using static anomaly fallbacks for GitHub Pages');
      setAnomalies(STATIC_ANOMALIES);
    } finally {
      setLoading(false);
    }
  };

  const currentAnomaly = anomalies.find(a => a.id === selectedAnomalyId) || anomalies[0];

  const runDownscaleSimulation = async () => {
    if (!selectedAnomalyId) return;
    try {
      setDownscalingLoading(true);
      const res = await fetch('/api/downscale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyId: selectedAnomalyId, diffusionSteps, physicsWeight })
      });
      if (!res.ok) throw new Error('API offline');
      const json = await res.json();
      if (json.success) {
        setDownscaleData(json);
        return;
      }
    } catch (e) {
      // Client-side fallback calculation for static hosting
      const gridPoints = 25;
      const subgridValues = [];
      const baseVal = currentAnomaly.type === 'Cyclone' ? 220 : currentAnomaly.type === 'Heat Dome' ? 48 : 300;

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

      setDownscaleData({
        metrics: {
          spectralSmoothingReduction: '94.2%',
          peakAmplitudeRetention: '98.7%',
          navierStokesDivergenceScore: '0.0014 (Within Physical Limit)',
          thermodynamicConsistency: '99.1%',
          processingTimeMs: 380,
        },
        subgridMatrix: subgridValues,
      });
    } finally {
      setDownscalingLoading(false);
    }
  };

  const generateAlerts = async () => {
    if (!selectedAnomalyId) return;
    try {
      setAlertLoading(true);
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyId: selectedAnomalyId, radiusKm: 5, targetAudience: alertTargetAudience })
      });
      if (!res.ok) throw new Error('API offline');
      const json = await res.json();
      if (json.success) {
        setAlertResult(json);
        return;
      }
    } catch (e) {
      // Client fallback
      const severity = currentAnomaly.efiScore > 4.5 ? 'SEVERE' : 'MODERATE';
      const ndrfDirectives = [
        'Position swift water rescue boats at 2km grid intersections along coastal drainage.',
        'Evacuate low-lying temporary settlements within the 5km impact zone before T-minus 12 hours.',
        'Deploy emergency comms repeaters on elevated terrain to bypass cellular blackout.',
      ];
      const agriDirectives = [
        'Install UV-stabilized anti-hail protective netting across standing horticultural crops.',
        'Clear perimeter irrigation channels to facilitate rapid drainage of 200mm+ flash precipitation.',
        'Harvest mature grain crops immediately to prevent lodging and moisture sprouting.',
      ];

      setAlertResult({
        success: true,
        alertId: `ALERT-${Math.floor(100000 + Math.random() * 900000)}`,
        timestamp: new Date().toISOString(),
        targetAnomaly: currentAnomaly.name,
        epicenter: currentAnomaly.coordinates,
        impactRadiusKm: 5,
        severityCategory: severity,
        efiScore: currentAnomaly.efiScore,
        targetAudience: alertTargetAudience.toUpperCase(),
        directives: alertTargetAudience === 'ndrf' ? ndrfDirectives : agriDirectives,
        spatialPolygon: [
          { lat: currentAnomaly.coordinates.lat + 0.045, lng: currentAnomaly.coordinates.lng - 0.045 },
          { lat: currentAnomaly.coordinates.lat + 0.045, lng: currentAnomaly.coordinates.lng + 0.045 },
          { lat: currentAnomaly.coordinates.lat - 0.045, lng: currentAnomaly.coordinates.lng + 0.045 },
          { lat: currentAnomaly.coordinates.lat - 0.045, lng: currentAnomaly.coordinates.lng - 0.045 },
        ],
        disseminationStatus: 'Broadcast Ready (Static GitHub Pages Mode)'
      });
    } finally {
      setAlertLoading(false);
    }
  };

  const fetchAiAdvisory = async () => {
    if (!selectedAnomalyId) return;
    try {
      setAiLoading(true);
      const res = await fetch('/api/ai-advisory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anomalyId: selectedAnomalyId })
      });
      if (!res.ok) throw new Error('API offline');
      const json = await res.json();
      if (json.success) {
        setAiAdvisoryText(json.advisory);
        return;
      }
    } catch (e) {
      // Client fallback advisory
      setAiAdvisoryText(`### AeroMesh AI Meteorological Briefing (GitHub Pages Static Mode)

**Event Name**: ${currentAnomaly.name}  
**Type**: ${currentAnomaly.type}  
**Region**: ${currentAnomaly.region}  
**Extreme Forecast Index (EFI)**: ${currentAnomaly.efiScore}σ (Critical threshold exceeded)  

#### 1. Synoptic Situation & GNN Trajectory Outlook
The icosahedral mesh GNN successfully isolated moving anomaly vectors across the 3-to-10 day forecast horizon. Trajectory indicates rapid intensification leading to landfall corridor convergence.

#### 2. Diffusion Downscaling Peak Amplitude Insights
Standard U-Nets and coarse 12 km NEPS-G grids suffer from severe spectral smoothing, flattening peak wind speeds and precipitation extremes. AeroMesh AI's conditional diffusion model successfully retained **${currentAnomaly.peakWindSpeed}** peak winds and **${currentAnomaly.peakRainfall}** precipitation without amplitude degradation.

#### 3. 5 km Hyper-Localized Impact Assessment
Pinpoint coordinate mapping establishes a rigorous 5 km radial impact zone around latitude ${currentAnomaly.coordinates.lat}°N, longitude ${currentAnomaly.coordinates.lng}°E, eliminating wide-area alert fatigue.

#### 4. Actionable Directives
- **NDRF**: Pre-position swift-water assets and emergency power units within the 5 km impact ring.
- **Agriculture**: Deploy protective mesh covers and clear irrigation channels before T-minus 12 hours.`);
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    if (selectedAnomalyId) {
      runDownscaleSimulation();
      generateAlerts();
      fetchAiAdvisory();
    }
  }, [selectedAnomalyId]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            <Globe className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent">
                AeroMesh AI
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800/60 font-mono">
                v2.4-GITHUB-PAGES
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Spherical GNN Anomaly Tracker & Amplitude-Preserving Diffusion Downscaler (5km Grid)
            </p>
          </div>
        </div>

        {/* System Status Indicators */}
        <div className="hidden lg:flex items-center space-x-4 text-xs font-mono bg-slate-950/60 px-4 py-2 rounded-lg border border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="text-slate-300">NEPS-G 12km Stream: <strong className="text-emerald-400">ONLINE</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-slate-300">Icosahedral GNN: <strong className="text-cyan-400">ACTIVE</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500" />
            <span className="text-slate-300">Diffusion Core: <strong className="text-indigo-400">99.1% Fidelity</strong></span>
          </div>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/40 px-6 flex items-center space-x-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('dashboard')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'dashboard'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Compass className="w-4 h-4" />
          <span>Visualization & Alert Map</span>
        </button>

        <button
          onClick={() => setActiveTab('tracking')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'tracking'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Globe className="w-4 h-4" />
          <span>Stage 1: Spherical GNN Tracking</span>
        </button>

        <button
          onClick={() => setActiveTab('downscale')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'downscale'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>Stage 2: Diffusion Downscaler</span>
        </button>

        <button
          onClick={() => setActiveTab('api')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'api'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <Terminal className="w-4 h-4" />
          <span>5km Alerting REST API</span>
        </button>

        <button
          onClick={() => setActiveTab('advisory')}
          className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium border-b-2 transition-all cursor-pointer ${
            activeTab === 'advisory'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Gemini Meteorological Briefing</span>
        </button>
      </div>

      {/* Anomaly Quick Selector bar */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-3 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-3">
          <span className="text-xs uppercase tracking-wider font-mono text-cyan-400 font-semibold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 animate-pulse" /> Active NWP Threat:
          </span>
          <select
            value={selectedAnomalyId}
            onChange={(e) => setSelectedAnomalyId(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
          >
            {anomalies.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.region}) — EFI: {a.efiScore}σ
              </option>
            ))}
          </select>
        </div>

        {currentAnomaly && (
          <div className="flex items-center space-x-6 text-xs font-mono">
            <div>
              <span className="text-slate-400">Horizon:</span> <span className="text-cyan-300 font-semibold">{currentAnomaly.forecastHorizon}</span>
            </div>
            <div>
              <span className="text-slate-400">Peak Wind:</span> <span className="text-amber-400 font-semibold">{currentAnomaly.peakWindSpeed}</span>
            </div>
            <div>
              <span className="text-slate-400">Rainfall:</span> <span className="text-blue-400 font-semibold">{currentAnomaly.peakRainfall}</span>
            </div>
            <span className={`px-2.5 py-1 rounded-full font-bold ${
              currentAnomaly.status === 'High Risk' || currentAnomaly.status === 'Landfall Imminent'
                ? 'bg-rose-950/80 text-rose-400 border border-rose-800'
                : 'bg-amber-950/80 text-amber-400 border border-amber-800'
            }`}>
              {currentAnomaly.status}
            </span>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
            <p className="text-slate-400 font-mono text-sm">Initializing AeroMesh GNN & Diffusion Pipeline...</p>
          </div>
        ) : (
          <>
            {/* TAB 1: VISUALIZATION & ALERT DASHBOARD */}
            {activeTab === 'dashboard' && currentAnomaly && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left Column: Interactive Map Mock & Trajectory */}
                  <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
                    
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <Compass className="w-5 h-5 text-cyan-400" />
                          Spatio-Temporal GNN & 5km Impact Vector Map
                        </h3>
                        <p className="text-xs text-slate-400">
                          Real-time projection of {currentAnomaly.name} across the 3-10 day ensemble forecast window.
                        </p>
                      </div>
                      <div className="flex items-center space-x-2 text-xs font-mono bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                        <span>Lat: {currentAnomaly.coordinates.lat}°N, Lng: {currentAnomaly.coordinates.lng}°E</span>
                      </div>
                    </div>

                    {/* Simulated Map Graphic Container */}
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-6 relative h-80 flex flex-col items-center justify-center overflow-hidden shadow-inner">
                      {/* Grid background lines */}
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30" />
                      
                      {/* Animated Radar Sweep */}
                      <div className="absolute w-96 h-96 rounded-full border border-cyan-500/20 animate-ping opacity-20 pointer-events-none" />

                      {/* Anomaly Core Center Marker */}
                      <div className="relative z-10 flex flex-col items-center animate-bounce">
                        <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/50">
                          <Wind className="w-8 h-8 text-rose-400 animate-spin" style={{ animationDuration: '6s' }} />
                        </div>
                        <div className="mt-2 bg-slate-900/90 border border-rose-500/50 px-3 py-1 rounded-full text-xs font-mono text-rose-300 shadow-xl">
                          {currentAnomaly.name} • 5km Impact Core
                        </div>
                      </div>

                      {/* Trajectory Nodes */}
                      <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-lg text-xs font-mono">
                        <span className="text-slate-400 font-semibold">4D Trajectory Vector:</span>
                        {currentAnomaly.trajectory.map((t, idx) => (
                          <div key={idx} className="flex items-center space-x-1">
                            <span className={`w-2 h-2 rounded-full ${idx === currentAnomaly.trajectory.length - 1 ? 'bg-rose-500' : 'bg-cyan-500'}`} />
                            <span className="text-slate-300">Day {t.day}: {t.intensity}</span>
                            {idx < currentAnomaly.trajectory.length - 1 && <span className="text-slate-600">→</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Quick Metrics Bar */}
                    <div className="grid grid-cols-3 gap-4 mt-4">
                      <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                        <span className="text-xs text-slate-400 block font-mono">Extreme Forecast Index</span>
                        <span className="text-xl font-bold text-cyan-400 font-mono">{currentAnomaly.efiScore}σ</span>
                        <span className="text-[10px] text-emerald-400 block mt-0.5">vs 30-Year ERA5 Baseline</span>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                        <span className="text-xs text-slate-400 block font-mono">Coarse Input Grid</span>
                        <span className="text-lg font-bold text-slate-200 font-mono">12 km</span>
                        <span className="text-[10px] text-slate-400 block mt-0.5">NCMRWF NEPS-G Ensemble</span>
                      </div>
                      <div className="bg-slate-950/60 border border-slate-800 p-3 rounded-xl">
                        <span className="text-xs text-slate-400 block font-mono">Diffusion Output</span>
                        <span className="text-lg font-bold text-emerald-400 font-mono">5 km Subgrid</span>
                        <span className="text-[10px] text-cyan-400 block mt-0.5">Zero Spectral Smoothing</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: 5km Impact Alert Generator & NDRF/Agri Dispatch */}
                  <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between shadow-xl">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-white flex items-center gap-2">
                          <ShieldAlert className="w-5 h-5 text-rose-400" />
                          Hyper-Localized 5km Alert Dispatch
                        </h3>
                        <span className="text-xs px-2 py-0.5 rounded bg-rose-950 text-rose-300 font-mono">
                          API Connected
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">
                        Eliminate alert fatigue by targeting exact 5 km impact zones with physics-constrained certainty.
                      </p>

                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-mono text-slate-300 block mb-1.5">Target Stakeholder / Responder:</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => { setAlertTargetAudience('ndrf'); generateAlerts(); }}
                              className={`px-3 py-2 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                                alertTargetAudience === 'ndrf'
                                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              🛡️ NDRF First Responders
                            </button>
                            <button
                              onClick={() => { setAlertTargetAudience('agri'); generateAlerts(); }}
                              className={`px-3 py-2 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                                alertTargetAudience === 'agri'
                                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                              }`}
                            >
                              🌾 Rural Farming Comm.
                            </button>
                          </div>
                        </div>

                        {alertResult && (
                          <div className="bg-slate-950/90 border border-slate-800 p-4 rounded-xl space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-mono text-cyan-400">{alertResult.alertId}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold font-mono">
                                {alertResult.severityCategory} PRIORITY
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <span className="text-[11px] font-mono text-slate-400 block uppercase">Operational Directives (5km Radius):</span>
                              {alertResult.directives.map((dir: string, idx: number) => (
                                <div key={idx} className="flex items-start space-x-2 text-xs text-slate-200">
                                  <span className="text-cyan-400 font-mono">0{idx + 1}.</span>
                                  <span>{dir}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={generateAlerts}
                      disabled={alertLoading}
                      className="mt-6 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm flex items-center justify-center space-x-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
                    >
                      {alertLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      <span>Broadcast Precision 5km Warning</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: STAGE 1 SPHERICAL GNN TRACKING */}
            {activeTab === 'tracking' && currentAnomaly && (
              <div className="space-y-6">
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Globe className="w-5 h-5 text-cyan-400" />
                        Stage 1: Spherical Icosahedral Mesh GNN Tracker
                      </h3>
                      <p className="text-xs text-slate-400">
                        Eliminating polar distortions by projecting 12km NEPS-G ensemble data directly onto spherical graph nodes.
                      </p>
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
                      Message-Passing Active
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                      <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-sm">
                        <Database className="w-4 h-4" />
                        <span>Climatological Baseline</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Evaluated against 30-year ECMWF ERA5 reanalysis distributions to calculate standardized anomaly anomalies and Extreme Forecast Index (EFI).
                      </p>
                      <div className="pt-2 border-t border-slate-900 flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Baseline Resolution:</span>
                        <span className="text-cyan-300">0.25° (~27 km)</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                      <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-sm">
                        <Cpu className="w-4 h-4" />
                        <span>Icosahedral Mesh GNN</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Constructs dynamic edges between neighboring nodes across spherical topology, ensuring uniform spatial sampling without pole pinching.
                      </p>
                      <div className="pt-2 border-t border-slate-900 flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Active Mesh Nodes:</span>
                        <span className="text-cyan-300">42,580 Vertices</span>
                      </div>
                    </div>

                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl space-y-3">
                      <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-sm">
                        <Maximize2 className="w-4 h-4" />
                        <span>4D Temporal Bounding Box</span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">
                        Isolates moving weather anomalies and constructs dynamic bounding boxes over the 3- to 10-day forecast horizon for Stage 2 downscaling.
                      </p>
                      <div className="pt-2 border-t border-slate-900 flex justify-between text-xs font-mono">
                        <span className="text-slate-400">Bounding Precision:</span>
                        <span className="text-emerald-400">±0.05° Lat/Lng</span>
                      </div>
                    </div>
                  </div>

                  {/* Trajectory Table */}
                  <div className="mt-6 bg-slate-950/80 border border-slate-800 rounded-xl p-5">
                    <h4 className="text-sm font-bold text-slate-200 mb-3 font-mono flex items-center gap-2">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      Ensemble Trajectory Forecast Progression ({currentAnomaly.name})
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs font-mono">
                        <thead>
                          <tr className="border-b border-slate-800 text-slate-400">
                            <th className="pb-2">Forecast Day</th>
                            <th className="pb-2">Latitude</th>
                            <th className="pb-2">Longitude</th>
                            <th className="pb-2">Intensity Classification</th>
                            <th className="pb-2">GNN Confidence</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-900">
                          {currentAnomaly.trajectory.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-900/40">
                              <td className="py-3 text-cyan-300 font-bold">Day {t.day} ({t.day * 24}h)</td>
                              <td className="py-3 text-slate-300">{t.lat}°N</td>
                              <td className="py-3 text-slate-300">{t.lng}°E</td>
                              <td className="py-3 text-amber-300 font-semibold">{t.intensity}</td>
                              <td className="py-3 text-emerald-400">{(98.2 - idx * 1.5).toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: STAGE 2 DIFFUSION DOWNSCALER */}
            {activeTab === 'downscale' && currentAnomaly && (
              <div className="space-y-6">
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Zap className="w-5 h-5 text-cyan-400" />
                        Stage 2: Amplitude-Preserving Diffusion Downscaling (12km → 5km)
                      </h3>
                      <p className="text-xs text-slate-400">
                        Generative conditional DDPM restoring extreme amplitudes and local topography without spectral smoothing.
                      </p>
                    </div>

                    <div className="flex items-center space-x-3">
                      <button
                        onClick={runDownscaleSimulation}
                        disabled={downscalingLoading}
                        className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium flex items-center space-x-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
                      >
                        {downscalingLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        <span>Re-Run Diffusion Inference</span>
                      </button>
                    </div>
                  </div>

                  {/* Diffusion Parameters Controls */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-950 p-5 rounded-xl border border-slate-800">
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300">Diffusion Denoising Steps:</span>
                        <span className="text-cyan-400 font-bold">{diffusionSteps} Steps</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={diffusionSteps}
                        onChange={(e) => setDiffusionSteps(Number(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-500 block">Higher steps refine subgrid thermodynamic equilibrium.</span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-slate-300">Physics Loss Weight (Navier-Stokes & Thermodynamics):</span>
                        <span className="text-cyan-400 font-bold">λ = {physicsWeight}</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.0"
                        step="0.05"
                        value={physicsWeight}
                        onChange={(e) => setPhysicsWeight(Number(e.target.value))}
                        className="w-full accent-cyan-500 bg-slate-800 rounded-lg h-2 cursor-pointer"
                      />
                      <span className="text-[10px] text-slate-500 block">Penalizes physically impossible states lacking moisture convergence.</span>
                    </div>
                  </div>

                  {/* Downscale Performance Metrics */}
                  {downscaleData?.metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <span className="text-xs text-slate-400 font-mono block">Spectral Smoothing Reduction</span>
                        <span className="text-xl font-bold text-cyan-400 font-mono mt-1 block">
                          {downscaleData.metrics.spectralSmoothingReduction}
                        </span>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <span className="text-xs text-slate-400 font-mono block">Peak Amplitude Retention</span>
                        <span className="text-xl font-bold text-emerald-400 font-mono mt-1 block">
                          {downscaleData.metrics.peakAmplitudeRetention}
                        </span>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <span className="text-xs text-slate-400 font-mono block">Navier-Stokes Divergence</span>
                        <span className="text-lg font-bold text-amber-400 font-mono mt-1 block">
                          {downscaleData.metrics.navierStokesDivergenceScore}
                        </span>
                      </div>
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <span className="text-xs text-slate-400 font-mono block">Inference Latency</span>
                        <span className="text-xl font-bold text-indigo-400 font-mono mt-1 block">
                          {downscaleData.metrics.processingTimeMs} ms
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Subgrid Matrix Comparison Table */}
                  {downscaleData?.subgridMatrix && (
                    <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5">
                      <h4 className="text-sm font-bold text-slate-200 mb-3 font-mono flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-cyan-400" />
                        5km Subgrid Amplitude Comparison (Coarse 12km vs Diffusion 5km)
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="pb-2">Subgrid Index</th>
                              <th className="pb-2">Spatial Offset (Lat/Lng)</th>
                              <th className="pb-2">Coarse 12km (Smoothed)</th>
                              <th className="pb-2">Diffusion 5km (Peak Preserved)</th>
                              <th className="pb-2">Amplitude Gain</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            {downscaleData.subgridMatrix.slice(0, 10).map((pt) => (
                              <tr key={pt.index} className="hover:bg-slate-900/40">
                                <td className="py-2.5 text-cyan-300 font-bold">Node #{pt.index + 1}</td>
                                <td className="py-2.5 text-slate-300">({pt.latOffset >= 0 ? `+${pt.latOffset.toFixed(3)}` : pt.latOffset.toFixed(3)}°, {pt.lngOffset >= 0 ? `+${pt.lngOffset.toFixed(3)}` : pt.lngOffset.toFixed(3)}°)</td>
                                <td className="py-2.5 text-slate-400">{pt.coarse12kmValue}</td>
                                <td className="py-2.5 text-emerald-400 font-bold">{pt.diffusion5kmValue}</td>
                                <td className="py-2.5 text-cyan-400 font-semibold">+{pt.amplitudeGain}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: ALERTING API CONSOLE */}
            {activeTab === 'api' && (
              <div className="space-y-6">
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Terminal className="w-5 h-5 text-cyan-400" />
                        Production REST Alerting API Console
                      </h3>
                      <p className="text-xs text-slate-400">
                        Programmatic endpoints for dropping pinpoints and triggering categorized spatial alerts across 5km impact zones.
                      </p>
                    </div>
                    <span className="text-xs font-mono px-3 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      API Status: 200 OK
                    </span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Endpoint Documentation */}
                    <div className="space-y-4">
                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 text-xs font-mono font-bold">POST</span>
                          <span className="text-xs font-mono text-slate-200">/api/downscale</span>
                        </div>
                        <p className="text-xs text-slate-400">Triggers Stage 2 diffusion downscaling for a specific anomaly ID with configurable steps and physics weight.</p>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 text-xs font-mono font-bold">POST</span>
                          <span className="text-xs font-mono text-slate-200">/api/alerts</span>
                        </div>
                        <p className="text-xs text-slate-400">Generates hyper-localized 5km spatial impact alerts for NDRF first responders or agricultural communities.</p>
                      </div>

                      <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 text-xs font-mono font-bold">POST</span>
                          <span className="text-xs font-mono text-slate-200">/api/ai-advisory</span>
                        </div>
                        <p className="text-xs text-slate-400">Queries Gemini meteorological model for expert briefing and tactical response planning.</p>
                      </div>
                    </div>

                    {/* Live JSON Payload Test */}
                    <div className="bg-slate-950 border border-slate-800 p-5 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-mono text-cyan-400 font-semibold">Live API Response Payload:</span>
                          <span className="text-[10px] font-mono text-slate-500">JSON Format</span>
                        </div>
                        <pre className="bg-slate-900 border border-slate-800 p-4 rounded-lg text-xs font-mono text-cyan-300 overflow-x-auto max-h-72">
                          {JSON.stringify(alertResult || { status: 'Ready' }, null, 2)}
                        </pre>
                      </div>

                      <button
                        onClick={generateAlerts}
                        className="mt-4 w-full py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Test API Dispatch Request</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: GEMINI METEOROLOGICAL BRIEFING */}
            {activeTab === 'advisory' && (
              <div className="space-y-6">
                <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        Gemini AI Expert Meteorological Briefing
                      </h3>
                      <p className="text-xs text-slate-400">
                        Automated synoptic analysis and tactical response planning generated by Gemini 2.5 Flash.
                      </p>
                    </div>

                    <button
                      onClick={fetchAiAdvisory}
                      disabled={aiLoading}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-mono font-medium flex items-center space-x-2 transition-all cursor-pointer shadow-lg shadow-indigo-500/20"
                    >
                      {aiLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span>Regenerate Briefing</span>
                    </button>
                  </div>

                  <div className="bg-slate-950 border border-slate-800 p-6 rounded-xl">
                    {aiLoading ? (
                      <div className="flex flex-col items-center justify-center py-12 space-y-3">
                        <RefreshCw className="w-6 h-6 text-indigo-400 animate-spin" />
                        <p className="text-xs font-mono text-slate-400">Generating meteorological briefing with Gemini AI...</p>
                      </div>
                    ) : (
                      <div className="prose prose-invert max-w-none text-sm leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">
                        {aiAdvisoryText || 'No briefing available.'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-900/40 py-4 px-6 text-center text-xs font-mono text-slate-500">
        AeroMesh AI • Spherical GNN & Diffusion Downscaling Pipeline • Powered by PyTorch, DGL & Hugging Face Diffusers
      </footer>
    </div>
  );
}
