import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Linking, Pressable, useWindowDimensions, View } from 'react-native';
import { Camera, useCameraDevice, useCameraFormat, useCameraPermission, useMicrophonePermission } from 'react-native-vision-camera';

import { SkeletonOverlay } from '@/components/SkeletonOverlay';
import { Button, Chip, Header, Screen, T } from '@/components/ui';
import { KICK_EMOJI } from '@/constants/kicks';
import { useLivePose } from '@/features/pose/useLivePose';
import { t, tList } from '@/i18n';
import { config } from '@/lib/config';
import { haptic } from '@/lib/haptics';
import { colors } from '@/lib/theme';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useSessionStore } from '@/store/useSessionStore';

const MAX_MS = config.limits.maxClipSeconds * 1000;

export default function RecordCamera() {
  const { width, height } = useWindowDimensions();
  const device = useCameraDevice('back');
  const format = useCameraFormat(device, [{ videoResolution: { width: 1280, height: 720 } }, { fps: 30 }]);
  const cam = useCameraPermission();
  const mic = useMicrophonePermission();
  const cameraRef = useRef<Camera>(null);
  const [active, setActive] = useState(true);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [showGuide, setShowGuide] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [camDenied, setCamDenied] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);

  const kickType = useSessionStore((s) => s.kickType);
  const retakeOfId = useSessionStore((s) => s.retakeOfId);
  const setClip = useSessionStore((s) => s.setClip);
  const setPoseFrames = useSessionStore((s) => s.setPoseFrames);
  const retakeOf = useHistoryStore((s) => s.analyses.find((a) => a.id === retakeOfId));

  const pose = useLivePose(active && cam.hasPermission);

  useEffect(() => {
    if (!cam.hasPermission) cam.requestPermission().then((ok) => setCamDenied(!ok));
    if (!mic.hasPermission) mic.requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const stop = useCallback(async () => {
    if (!recording) return;
    if (timer.current) clearInterval(timer.current);
    await cameraRef.current?.stopRecording().catch(() => {});
  }, [recording]);

  const start = useCallback(() => {
    if (!cameraRef.current || recording) return;
    haptic.medium();
    setShowGuide(false);
    setRecording(true);
    setElapsed(0);
    startedAt.current = Date.now();
    pose.startCollecting();
    timer.current = setInterval(() => {
      const ms = Date.now() - startedAt.current;
      setElapsed(ms);
      if (ms >= MAX_MS) {
        if (timer.current) clearInterval(timer.current);
        cameraRef.current?.stopRecording().catch(() => {});
      }
    }, 100);
    cameraRef.current.startRecording({
      fileType: 'mp4',
      videoCodec: 'h264',
      onRecordingFinished: (video) => {
        setRecording(false);
        const frames = pose.stopCollecting();
        setPoseFrames(frames);
        const uri = video.path.startsWith('file://') ? video.path : `file://${video.path}`;
        setClip(uri, video.duration, 'camera');
        haptic.success();
        router.push('/record/preview');
      },
      onRecordingError: (e) => {
        setRecording(false);
        pose.stopCollecting();
        if (timer.current) clearInterval(timer.current);
        Alert.alert(t('errors.recordFailed'), e.message);
      },
    });
  }, [pose, recording, setClip, setPoseFrames]);

  const importClip = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: true, videoMaxDuration: config.limits.maxClipSeconds, quality: 1 });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    const durationSec = asset.duration != null ? asset.duration / 1000 : null;
    if (durationSec != null && durationSec > config.limits.maxClipSeconds + 1) {
      Alert.alert(t('record.tooLong', { max: config.limits.maxClipSeconds }));
      return;
    }
    setPoseFrames([]);
    setClip(asset.uri, durationSec, 'import');
    router.push('/record/preview');
  }, [setClip, setPoseFrames]);

  const seconds = (elapsed / 1000).toFixed(1);

  if (!cam.hasPermission) {
    return (
      <Screen>
        <Header title={t('record.setupTitle')} />
        <View className="flex-1 items-center justify-center gap-4 px-4">
          <Ionicons name="camera-outline" size={48} color={colors.pitch} />
          <T variant="heading" className="text-center">
            {t('record.permissionTitle')}
          </T>
          <T variant="caption" className="text-center">
            {t('record.permissionBody')}
          </T>
          {camDenied ? (
            <Button label={t('record.permissionSettings')} onPress={() => Linking.openSettings()} size="md" variant="secondary" />
          ) : (
            <Button label={t('record.permissionCta')} onPress={() => cam.requestPermission().then((ok) => setCamDenied(!ok))} size="md" />
          )}
          <Button label={t('record.import')} onPress={importClip} size="md" variant="ghost" />
        </View>
      </Screen>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {device && !cameraError ? (
        <Camera
          ref={cameraRef}
          style={{ position: 'absolute', width, height }}
          device={device}
          format={format}
          fps={30}
          isActive={active}
          video
          audio={mic.hasPermission}
          resizeMode="cover"
          videoStabilizationMode="auto"
          frameProcessor={pose.frameProcessor}
          onInitialized={() => setActive(true)}
          onError={(e) => setCameraError(e.message)}
        />
      ) : (
        <View className="absolute inset-0 items-center justify-center px-8">
          <T variant="caption" className="text-center">
            {cameraError ? t('errors.cameraInit') : t('record.noDevice')}
          </T>
        </View>
      )}
      <SkeletonOverlay frame={pose.latest} width={width} height={height} />

      <Screen padded={false} transparent edges={['top', 'bottom']}>
        <View className="flex-1 justify-between px-5">
          <View className="gap-3">
            <Header title={`${KICK_EMOJI[kickType]} ${t(`kicks.${kickType}`)}`} onBack={() => (recording ? stop() : router.back())} />
            <View className="flex-row flex-wrap gap-2">
              {recording ? <Chip label={`● ${t('record.recording')} ${seconds}s`} tone="gold" /> : <Chip label={t('record.maxLength')} />}
              {pose.modelState.state === 'ready' ? (
                <Chip label={pose.fullBodyVisible ? t('record.trackingGood') : t('record.trackingLost')} tone={pose.fullBodyVisible ? 'accent' : 'muted'} />
              ) : pose.modelState.state === 'loading' ? (
                <Chip label={t('common.loading')} />
              ) : null}
              {retakeOf ? <Chip label={t('record.retakeBanner', { score: retakeOf.kickRating })} tone="accent" /> : null}
            </View>
            {pose.modelState.state === 'unavailable' && showGuide ? (
              <T variant="caption" className="text-gold">
                {t('record.poseUnavailable')}
              </T>
            ) : null}
          </View>

          {showGuide && !recording ? (
            <Pressable onPress={() => setShowGuide(false)} className="rounded-2xl border border-line bg-bg/80 p-4">
              <T variant="label" className="mb-2">
                {t('record.setupTitle')}
              </T>
              {tList('record.setupSteps').map((s, i) => (
                <View key={s} className="flex-row items-center gap-2 py-0.5">
                  <T variant="caption" className="text-pitch">
                    {i + 1}.
                  </T>
                  <T variant="caption" className="text-ink">
                    {s}
                  </T>
                </View>
              ))}
            </Pressable>
          ) : null}

          <View className="items-center gap-4 pb-6">
            <View className="h-1.5 w-full overflow-hidden rounded-full bg-surface2">
              <View className="h-full bg-gold" style={{ width: `${Math.min(100, (elapsed / MAX_MS) * 100)}%` }} />
            </View>
            <View className="w-full flex-row items-center justify-between">
              <Pressable onPress={importClip} disabled={recording} accessibilityLabel={t('record.import')} className="h-14 w-14 items-center justify-center rounded-full bg-surface/90">
                <Ionicons name="images-outline" size={24} color={colors.ink} />
              </Pressable>
              <Pressable
                onPress={recording ? stop : start}
                accessibilityRole="button"
                accessibilityLabel={recording ? t('record.stop') : t('record.record')}
                className="h-20 w-20 items-center justify-center rounded-full border-4 border-white"
              >
                <View className={recording ? 'h-8 w-8 rounded-md bg-danger' : 'h-16 w-16 rounded-full bg-danger'} />
              </Pressable>
              <View className="h-14 w-14" />
            </View>
          </View>
        </View>
      </Screen>
    </View>
  );
}
