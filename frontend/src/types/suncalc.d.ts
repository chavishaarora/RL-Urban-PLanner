declare module 'suncalc' {
  export interface SunPosition {
    altitude: number;
    azimuth: number;
  }

  export interface SunTimes {
    sunrise: Date;
    sunset: Date;
    solarNoon: Date;
    dawn: Date;
    dusk: Date;
    nauticalDawn: Date;
    nauticalDusk: Date;
    nightEnd: Date;
    night: Date;
    goldenHourEnd: Date;
    goldenHour: Date;
  }

  export interface MoonPosition {
    altitude: number;
    azimuth: number;
    distance: number;
    parallacticAngle: number;
  }

  export interface MoonIllumination {
    fraction: number;
    phase: number;
    angle: number;
  }

  export function getPosition(date: Date, lat: number, lng: number): SunPosition;
  export function getTimes(date: Date, lat: number, lng: number): SunTimes;
  export function getMoonPosition(date: Date, lat: number, lng: number): MoonPosition;
  export function getMoonIllumination(date: Date): MoonIllumination;
  
  const SunCalc: {
    getPosition: typeof getPosition;
    getTimes: typeof getTimes;
    getMoonPosition: typeof getMoonPosition;
    getMoonIllumination: typeof getMoonIllumination;
  };
  
  export default SunCalc;
}
