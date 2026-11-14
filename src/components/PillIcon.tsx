import React from 'react';
import Svg, {
  Circle,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Rect,
} from 'react-native-svg';
import { PillShape } from '@/db/schema';

export interface PillIconProps {
  shape: PillShape;
  primaryColor: string;
  secondaryColor?: string;
  size?: number;
}

export function PillIcon({
  shape,
  primaryColor,
  secondaryColor = '#FFFFFF',
  size = 44,
}: PillIconProps) {
  const strokeColor = '#334155';

  switch (shape) {
    case 'round':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Circle
            cx="32"
            cy="32"
            r="22"
            fill={primaryColor}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          <Path
            d="M 20 22 A 16 16 0 0 1 38 16"
            stroke="#FFFFFF"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
            opacity={0.6}
          />
        </Svg>
      );

    case 'scored':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Circle
            cx="32"
            cy="32"
            r="22"
            fill={primaryColor}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          <Line
            x1="12"
            y1="32"
            x2="52"
            y2="32"
            stroke={strokeColor}
            strokeWidth="2.5"
          />
        </Svg>
      );

    case 'oval':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Ellipse
            cx="32"
            cy="32"
            rx="26"
            ry="16"
            fill={primaryColor}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          <Line
            x1="32"
            y1="17"
            x2="32"
            y2="47"
            stroke={strokeColor}
            strokeWidth="2"
            opacity={0.45}
          />
        </Svg>
      );

    case 'oblong':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Rect
            x="6"
            y="18"
            width="52"
            height="28"
            rx="14"
            fill={primaryColor}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          <Line
            x1="32"
            y1="19"
            x2="32"
            y2="45"
            stroke={strokeColor}
            strokeWidth="2"
          />
        </Svg>
      );

    case 'capsule':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <G transform="rotate(-30 32 32)">
            <Path
              d="M 18 32 L 18 20 A 14 14 0 0 1 46 20 L 46 32 Z"
              fill={primaryColor}
              stroke={strokeColor}
              strokeWidth="2.5"
            />
            <Path
              d="M 18 32 L 46 32 L 46 44 A 14 14 0 0 1 18 44 Z"
              fill={secondaryColor}
              stroke={strokeColor}
              strokeWidth="2.5"
            />
          </G>
        </Svg>
      );

    case 'triangle':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Polygon
            points="32,10 54,50 10,50"
            fill={primaryColor}
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'octagon':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Polygon
            points="22,10 42,10 54,22 54,42 42,54 22,54 10,42 10,22"
            fill={primaryColor}
            stroke={strokeColor}
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
        </Svg>
      );

    case 'bottle':
      return (
        <Svg width={size} height={size} viewBox="0 0 64 64">
          <Rect
            x="24"
            y="8"
            width="16"
            height="8"
            rx="2"
            fill={secondaryColor}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          <Path
            d="M 26 16 L 38 16 L 44 24 L 44 52 A 4 4 0 0 1 40 56 L 24 56 A 4 4 0 0 1 20 52 L 20 24 Z"
            fill={primaryColor}
            stroke={strokeColor}
            strokeWidth="2.5"
          />
          <Rect
            x="23"
            y="30"
            width="18"
            height="14"
            rx="2"
            fill="#FFFFFF"
            opacity={0.85}
          />
        </Svg>
      );

    default:
      return null;
  }
}
