import { Curve, type CurveProps } from 'recharts';

export function CashResultCurve({ outline, pathRef, ...curve }: CurveProps & { outline: string }) {
  return (
    <>
      <Curve {...curve} className="cash-result-outline" stroke={outline} strokeWidth={6} />
      <Curve {...curve} pathRef={pathRef} />
    </>
  );
}
