import { View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { colors, fonts } from '@/lib/theme';

interface Point {
  x: number;
  y: number;
  label?: string;
}

interface LineChartProps {
  points: Point[];
  width: number;
  height?: number;
  min?: number;
  max?: number;
}

/** Minimal rating-over-time chart. Dependency-free, SVG only. */
export function LineChart({ points, width, height = 160, min = 0, max = 100 }: LineChartProps) {
  const padL = 28;
  const padR = 12;
  const padT = 10;
  const padB = 22;
  const w = Math.max(1, width - padL - padR);
  const h = height - padT - padB;
  const n = points.length;
  const xAt = (i: number) => padL + (n <= 1 ? w / 2 : (i / (n - 1)) * w);
  const yAt = (v: number) => padT + h - ((v - min) / (max - min)) * h;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i).toFixed(1)} ${yAt(p.y).toFixed(1)}`).join(' ');
  const gridLines = [25, 50, 75, 100];

  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height}>
        {gridLines.map((g) => (
          <Line key={g} x1={padL} x2={width - padR} y1={yAt(g)} y2={yAt(g)} stroke={colors.line} strokeWidth={1} />
        ))}
        {gridLines.map((g) => (
          <SvgText key={`l${g}`} x={0} y={yAt(g) + 4} fontSize={10} fill={colors.muted} fontFamily={fonts.sans}>
            {g}
          </SvgText>
        ))}
        {n > 1 ? <Path d={path} stroke={colors.pitch} strokeWidth={3} fill="none" strokeLinejoin="round" /> : null}
        {points.map((p, i) => (
          <Circle key={i} cx={xAt(i)} cy={yAt(p.y)} r={4.5} fill={colors.bg} stroke={colors.pitch} strokeWidth={2.5} />
        ))}
        {points.map((p, i) =>
          p.label && (n <= 6 || i === 0 || i === n - 1 || i % Math.ceil(n / 5) === 0) ? (
            <SvgText
              key={`x${i}`}
              x={xAt(i)}
              y={height - 6}
              fontSize={10}
              fill={colors.muted}
              textAnchor="middle"
              fontFamily={fonts.sans}
            >
              {p.label}
            </SvgText>
          ) : null,
        )}
      </Svg>
    </View>
  );
}
