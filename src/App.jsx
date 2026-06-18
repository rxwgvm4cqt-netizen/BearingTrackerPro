import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from './components/AppShell'
import LoginScreen from './components/LoginScreen'
import TrackingPage from './pages/TrackingPage'
import AnalysisPage from './pages/AnalysisPage'
import BearingDataPage from './pages/BearingDataPage'
import { bearingPresets } from './data/bearingPresets'
import { LOGIN_STORAGE_KEY, STATIC_LOGIN } from './config/auth'
import { LANGUAGE_STORAGE_KEY, translations } from './i18n/translations'
import {
  LISTENING_POSITION_ANGLE,
  describeRollerPosition,
  getCageRpm,
  getNearestRollerIndexAtAngle,
  getRollerAngleToBladeA,
  rpmToAngleDelta,
} from './utils/bearingMath'
import './styles/app.css'

const MOCK_RPM = 9.87
const STOP_DURATION_SECONDS = 30
const DEFAULT_JOG_RPM = 0.2
const MIN_JOG_RPM = 0.02
const MAX_JOG_RPM = 1
const JOG_RPM_STEP = 0.02
const ROLLER_10_OCLOCK_START_ANGLE = LISTENING_POSITION_ANGLE + 90
const DEFAULT_LANGUAGE = 'de'

function getStoredLanguage() {
  const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)

  return storedLanguage === 'en' || storedLanguage === 'de'
    ? storedLanguage
    : DEFAULT_LANGUAGE
}

function translatePositionLabel(positionLabel, t) {
  const positionLabelMap = {
    'kein Defekt markiert': 'noDefectMarked',
    'nahe 10 Uhr': 'positionNearTen',
    'zwischen A und B': 'positionBetweenAB',
    'zwischen B und C': 'positionBetweenBC',
    'zwischen C und A': 'positionBetweenCA',
  }

  return positionLabelMap[positionLabel] ? t(positionLabelMap[positionLabel]) : positionLabel
}

function createInitialTrackingState() {
  return {
    outerAngleDeg: 0,
    cageAngleDeg: ROLLER_10_OCLOCK_START_ANGLE,
    outerRevolutions: 0,
    cageRevolutions: 0,
    outerRunning: false,
    cageRunning: false,
    positioningMode: false,
    jogDirection: 0,
    rpmScale: 1,
    plantStopping: false,
    plantStopped: false,
    plantStopElapsedMs: 0,
    stopStartTime: null,
    stopStartRPM: null,
    referenceBlade: 'A',
    suspiciousRollerIndex: null,
    defectEvents: [],
  }
}

function App() {
  const initialPreset = bearingPresets[0]
  const [isLoggedIn, setIsLoggedIn] = useState(
    () => localStorage.getItem(LOGIN_STORAGE_KEY) === 'true',
  )
  const [language, setLanguageState] = useState(getStoredLanguage)
  const [activePage, setActivePage] = useState('tracking')
  const [selectedBearingPreset, setSelectedBearingPreset] =
    useState(initialPreset)
  const [bearingData, setBearingData] = useState({ ...initialPreset })
  const [trackingState, setTrackingState] = useState(createInitialTrackingState)
  const [jogRpm, setJogRpm] = useState(DEFAULT_JOG_RPM)
  const [rpmState, setRpmState] = useState({
    source: 'mock',
    value: MOCK_RPM,
  })

  const rollerCount = Math.max(1, bearingData.rollerCount || 198)
  const activeBaseRpm = rpmState.value ?? MOCK_RPM
  const cageRpm = getCageRpm(activeBaseRpm, bearingData)
  const t = useCallback(
    (key) =>
      translations[language]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key,
    [language],
  )

  const handleLanguageChange = (nextLanguage) => {
    if (nextLanguage !== 'de' && nextLanguage !== 'en') {
      return
    }

    localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage)
    setLanguageState(nextLanguage)
  }

  const handleLogin = ({ username, password }) => {
    const loginIsValid =
      username === STATIC_LOGIN.username && password === STATIC_LOGIN.password

    if (!loginIsValid) {
      return false
    }

    localStorage.setItem(LOGIN_STORAGE_KEY, 'true')
    setIsLoggedIn(true)
    return true
  }

  const handleLogout = () => {
    localStorage.removeItem(LOGIN_STORAGE_KEY)
    setIsLoggedIn(false)
  }

  const handlePresetChange = (presetId) => {
    const nextPreset =
      bearingPresets.find((preset) => preset.id === presetId) || initialPreset

    setSelectedBearingPreset(nextPreset)
    setBearingData({ ...nextPreset })
    setTrackingState((currentState) => ({
      ...createInitialTrackingState(),
      defectEvents: currentState.defectEvents,
    }))
  }

  const handleStableOcrRpm = (rpm) => {
    setRpmState({
      source: 'ocr',
      value: rpm,
    })
  }

  const handleOcrStop = () => {
    setRpmState({
      source: 'mock',
      value: MOCK_RPM,
    })
  }

  const handleReferenceBladeChange = (referenceBlade) => {
    setTrackingState((currentState) => ({
      ...currentState,
      referenceBlade,
      outerAngleDeg: 0,
    }))
  }

  const setOuterRunning = (outerRunning) => {
    setTrackingState((currentState) => ({
      ...currentState,
      outerRunning,
      positioningMode: outerRunning ? false : currentState.positioningMode,
      jogDirection: 0,
      plantStopping: false,
      plantStopped: outerRunning ? false : currentState.plantStopped,
      plantStopElapsedMs: 0,
      rpmScale: outerRunning ? 1 : currentState.rpmScale,
    }))
  }

  const setCageRunning = (cageRunning) => {
    setTrackingState((currentState) => ({
      ...currentState,
      cageRunning,
      positioningMode: cageRunning ? false : currentState.positioningMode,
      jogDirection: 0,
      plantStopping: false,
      plantStopped: cageRunning ? false : currentState.plantStopped,
      plantStopElapsedMs: 0,
      rpmScale: cageRunning ? 1 : currentState.rpmScale,
      cageAngleDeg: cageRunning
        ? ROLLER_10_OCLOCK_START_ANGLE
        : currentState.cageAngleDeg,
    }))
  }

  const handleCombinedStartStop = () => {
    setTrackingState((currentState) => {
      const nextRunning = !(currentState.outerRunning || currentState.cageRunning)

      return {
        ...currentState,
        outerRunning: nextRunning,
        cageRunning: nextRunning,
        positioningMode: nextRunning ? false : currentState.positioningMode,
        jogDirection: 0,
        plantStopping: false,
        plantStopped: nextRunning ? false : currentState.plantStopped,
        plantStopElapsedMs: 0,
        rpmScale: nextRunning ? 1 : currentState.rpmScale,
        cageAngleDeg: nextRunning
          ? ROLLER_10_OCLOCK_START_ANGLE
          : currentState.cageAngleDeg,
      }
    })
  }

  const handleResetTracking = () => {
    setTrackingState((currentState) => ({
      ...createInitialTrackingState(),
      defectEvents: currentState.defectEvents,
    }))
  }

  const handlePlantStop = () => {
    const now = Date.now()

    setTrackingState((currentState) => {
      const currentRpm = activeBaseRpm * currentState.rpmScale

      return {
        ...currentState,
        outerRunning: currentRpm > 0.05,
        cageRunning: currentRpm > 0.05,
        positioningMode: false,
        jogDirection: 0,
        plantStopping: currentRpm > 0.05,
        plantStopped: currentRpm <= 0.05,
        plantStopElapsedMs: 0,
        stopStartTime: now,
        stopStartRPM: currentRpm,
      }
    })
  }

  const togglePositioningMode = () => {
    setTrackingState((currentState) => {
      const canPosition =
        !currentState.outerRunning &&
        !currentState.cageRunning &&
        !currentState.plantStopping

      return {
        ...currentState,
        positioningMode: canPosition ? !currentState.positioningMode : false,
        jogDirection: 0,
      }
    })
  }

  const setJogDirection = (jogDirection) => {
    setTrackingState((currentState) => {
      const canJog =
        currentState.positioningMode &&
        !currentState.outerRunning &&
        !currentState.cageRunning &&
        !currentState.plantStopping

      return {
        ...currentState,
        jogDirection: canJog ? jogDirection : 0,
      }
    })
  }

  const handleDefectHeard = () => {
    setTrackingState((currentState) => {
      const suspiciousRollerIndex = getNearestRollerIndexAtAngle(
        rollerCount,
        currentState.cageAngleDeg,
      )
      const angleToA = getRollerAngleToBladeA(
        suspiciousRollerIndex,
        rollerCount,
        currentState.cageAngleDeg,
        currentState.referenceBlade,
        currentState.outerAngleDeg,
      )
      const defectEvent = {
        id: `${Date.now()}-${suspiciousRollerIndex}`,
        timestamp: new Date().toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
        rpm: activeBaseRpm * currentState.rpmScale,
        referenceBlade: currentState.referenceBlade,
        rollerNumber: suspiciousRollerIndex + 1,
        angleToA,
      }

      return {
        ...currentState,
        suspiciousRollerIndex,
        defectEvents: [defectEvent, ...currentState.defectEvents],
      }
    })
  }

  useEffect(() => {
    if (
      !isLoggedIn ||
      (!trackingState.outerRunning &&
        !trackingState.cageRunning &&
        trackingState.jogDirection === 0)
    ) {
      return undefined
    }

    let animationFrameId
    let lastFrameTime = performance.now()

    const animate = (currentFrameTime) => {
      const elapsedMs = currentFrameTime - lastFrameTime
      lastFrameTime = currentFrameTime

      setTrackingState((currentState) => {
        const nextPlantStopElapsedMs = currentState.plantStopping
          ? Math.min(
              currentState.plantStopElapsedMs + elapsedMs,
              STOP_DURATION_SECONDS * 1000,
            )
          : currentState.plantStopElapsedMs
        const nextCurrentRpm = currentState.plantStopping
          ? Math.max(
              0,
              currentState.stopStartRPM *
                (1 - nextPlantStopElapsedMs / (STOP_DURATION_SECONDS * 1000)),
            )
          : activeBaseRpm * currentState.rpmScale
        const currentFrameRpm = activeBaseRpm * currentState.rpmScale
        const frameOuterRpm = currentState.plantStopping
          ? (currentFrameRpm + nextCurrentRpm) / 2
          : currentFrameRpm
        const frameCageRpm = getCageRpm(frameOuterRpm, bearingData)
        const jogDirectionName = currentState.jogDirection > 0 ? 'cw' : 'ccw'
        const outerAngleDelta = currentState.outerRunning
          ? rpmToAngleDelta(frameOuterRpm, elapsedMs, 'ccw')
          : currentState.jogDirection !== 0
            ? rpmToAngleDelta(jogRpm, elapsedMs, jogDirectionName)
            : 0
        const cageAngleDelta = currentState.cageRunning
          ? rpmToAngleDelta(frameCageRpm, elapsedMs, 'ccw')
          : currentState.jogDirection !== 0
            ? rpmToAngleDelta(
                getCageRpm(jogRpm, bearingData),
                elapsedMs,
                jogDirectionName,
              )
            : 0
        const outerRevolutionDelta =
          currentState.jogDirection !== 0
            ? outerAngleDelta / 360
            : Math.abs(outerAngleDelta) / 360
        const cageRevolutionDelta =
          currentState.jogDirection !== 0
            ? cageAngleDelta / 360
            : Math.abs(cageAngleDelta) / 360
        const plantHasStopped =
          currentState.plantStopping &&
          nextPlantStopElapsedMs >= STOP_DURATION_SECONDS * 1000

        return {
          ...currentState,
          outerAngleDeg: currentState.outerAngleDeg + outerAngleDelta,
          cageAngleDeg: currentState.cageAngleDeg + cageAngleDelta,
          outerRevolutions: currentState.outerRevolutions + outerRevolutionDelta,
          cageRevolutions: currentState.cageRevolutions + cageRevolutionDelta,
          outerRunning: plantHasStopped ? false : currentState.outerRunning,
          cageRunning: plantHasStopped ? false : currentState.cageRunning,
          plantStopping: plantHasStopped ? false : currentState.plantStopping,
          plantStopped: plantHasStopped ? true : currentState.plantStopped,
          plantStopElapsedMs: plantHasStopped ? 0 : nextPlantStopElapsedMs,
          rpmScale:
            plantHasStopped || activeBaseRpm <= 0 ? 0 : nextCurrentRpm / activeBaseRpm,
        }
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    animationFrameId = requestAnimationFrame(animate)

    return () => cancelAnimationFrame(animationFrameId)
  }, [
    activeBaseRpm,
    bearingData,
    cageRpm,
    isLoggedIn,
    jogRpm,
    trackingState.cageRunning,
    trackingState.jogDirection,
    trackingState.outerRunning,
  ])

  const trackingMetrics = useMemo(() => {
    const currentRpm = activeBaseRpm * trackingState.rpmScale
    const currentCageRpm = getCageRpm(currentRpm, bearingData)
    const remainingStopSeconds = trackingState.plantStopping
      ? Math.max(
          0,
          STOP_DURATION_SECONDS - trackingState.plantStopElapsedMs / 1000,
        )
      : trackingState.plantStopped
        ? 0
        : null
    const angleToA = getRollerAngleToBladeA(
      trackingState.suspiciousRollerIndex,
      rollerCount,
      trackingState.cageAngleDeg,
      trackingState.referenceBlade,
      trackingState.outerAngleDeg,
    )

    return {
      rpm: currentRpm,
      cageRpm: currentCageRpm,
      stopDurationSeconds: STOP_DURATION_SECONDS,
      plantStopStartTime: trackingState.stopStartTime,
      plantStopStartRPM: trackingState.stopStartRPM,
      estimatedStopSeconds: remainingStopSeconds,
      plantStopped: trackingState.plantStopped,
      plantStatus: trackingState.plantStopping
        ? t('plantStopping')
        : trackingState.plantStopped
          ? t('plantStopped')
          : t('running'),
      outerRevolutions: trackingState.outerRevolutions,
      cageRevolutions: trackingState.cageRevolutions,
      angleToA,
      referenceBlade: trackingState.referenceBlade,
      suspiciousRollerNumber:
        trackingState.suspiciousRollerIndex === null
          ? null
          : trackingState.suspiciousRollerIndex + 1,
      positionLabel: translatePositionLabel(
        describeRollerPosition(
          trackingState.suspiciousRollerIndex,
          rollerCount,
          trackingState.cageAngleDeg,
          trackingState.referenceBlade,
          trackingState.outerAngleDeg,
        ),
        t,
      ),
    }
  }, [activeBaseRpm, bearingData, rollerCount, t, trackingState])

  const sharedPageProps = {
    bearingData,
    defectEvents: trackingState.defectEvents,
    jogRpm,
    jogRpmMax: MAX_JOG_RPM,
    jogRpmMin: MIN_JOG_RPM,
    jogRpmStep: JOG_RPM_STEP,
    onCombinedStartStop: handleCombinedStartStop,
    onDefectHeard: handleDefectHeard,
    onJogDirectionChange: setJogDirection,
    onJogRpmChange: setJogRpm,
    onOcrStop: handleOcrStop,
    onPlantStop: handlePlantStop,
    onReferenceBladeChange: handleReferenceBladeChange,
    onResetTracking: handleResetTracking,
    onSetCageRunning: setCageRunning,
    onSetOuterRunning: setOuterRunning,
    onStableOcrRpm: handleStableOcrRpm,
    onTogglePositioningMode: togglePositioningMode,
    selectedBearingPreset,
    t,
    trackingMetrics,
    trackingState,
    onPresetChange: handlePresetChange,
  }

  const pages = {
    tracking: <TrackingPage {...sharedPageProps} />,
    analysis: <AnalysisPage {...sharedPageProps} />,
    bearingData: <BearingDataPage {...sharedPageProps} />,
  }

  if (!isLoggedIn) {
    return <LoginScreen t={t} onLogin={handleLogin} />
  }

  return (
    <AppShell
      activePage={activePage}
      language={language}
      onLogout={handleLogout}
      onLanguageChange={handleLanguageChange}
      onPageChange={setActivePage}
      t={t}
    >
      {pages[activePage]}
    </AppShell>
  )
}

export default App
