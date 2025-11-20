import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import SunCalc from 'suncalc';

interface SunSimulationProps {
    timeOfDay: number; // 0-24 hours
    latitude: number;
    longitude: number;
    date?: Date;
    month?: number; // 1-12, if provided overrides date month
}

export const SunSimulation: React.FC<SunSimulationProps> = ({
    timeOfDay,
    latitude,
    longitude,
    date = new Date(),
    month
}) => {
    const sunLightRef = useRef<THREE.DirectionalLight>(null);
    const sunMeshRef = useRef<THREE.Mesh>(null);

    useEffect(() => {
        if (!sunLightRef.current || !sunMeshRef.current) return;

        // SunCalc expects a JavaScript Date object representing the exact moment in time
        // The timeOfDay parameter represents the LOCAL TIME at the selected location (0-24 hours)
        const now = new Date();
        const year = now.getFullYear();
        const monthValue = month !== undefined ? month - 1 : now.getMonth();
        
        // Calculate the timezone offset for the location based on longitude
        // Longitude: -180 to 180, where each 15° = 1 hour of time difference from UTC
        const timezoneOffsetHours = longitude / 15;
        
        // Convert the local time at the location to UTC
        // If location is at +75° longitude (India, UTC+5), and timeOfDay is 14:00 local time,
        // then UTC time would be 14:00 - 5 = 09:00
        const utcHour = timeOfDay - timezoneOffsetHours;
        
        // Create date in UTC time
        const currentDate = new Date(Date.UTC(
            year, 
            monthValue, 
            15, // middle of month for consistent day throughout
            Math.floor(utcHour), 
            Math.floor((utcHour % 1) * 60), 
            0, 
            0
        ));

        console.log('Sun Calculation Debug:', {
            localTimeOfDay: timeOfDay.toFixed(2),
            latitude,
            longitude,
            month: monthValue + 1,
            timezoneOffsetHours: timezoneOffsetHours.toFixed(2),
            utcTime: currentDate.toISOString(),
            locationLocalTime: `${Math.floor(timeOfDay)}:${String(Math.floor((timeOfDay % 1) * 60)).padStart(2, '0')}`
        });

        // Use SunCalc for accurate sun position
        const sunPosition = SunCalc.getPosition(currentDate, latitude, longitude);
        
        // Get sun times for the location in UTC, then convert to local time for display
        const sunTimes = SunCalc.getTimes(currentDate, latitude, longitude);
        
        // Calculate local time versions of sun events
        const toLocalTime = (utcDate: Date) => {
            const utcHours = utcDate.getUTCHours() + utcDate.getUTCMinutes() / 60;
            const localHours = utcHours + timezoneOffsetHours;
            // Wrap around 24 hours
            const adjustedHours = ((localHours % 24) + 24) % 24;
            const hours = Math.floor(adjustedHours);
            const minutes = Math.floor((adjustedHours % 1) * 60);
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        };
        
        console.log('Sun Times for this location (Local Time):', {
            sunrise: toLocalTime(sunTimes.sunrise),
            sunset: toLocalTime(sunTimes.sunset),
            solarNoon: toLocalTime(sunTimes.solarNoon),
            currentLocalTime: `${Math.floor(timeOfDay)}:${String(Math.floor((timeOfDay % 1) * 60)).padStart(2, '0')}`
        });
        
        // sunPosition.altitude: angle of the sun above the horizon in radians
        // sunPosition.azimuth: sun azimuth in radians (direction along the horizon, measured from south to west)
        const altitude = sunPosition.altitude;
        const azimuth = sunPosition.azimuth;

        console.log('Sun Position:', {
            altitudeDegrees: (altitude * 180 / Math.PI).toFixed(2),
            azimuthDegrees: (azimuth * 180 / Math.PI).toFixed(2),
            isAboveHorizon: altitude > 0
        });

        // Convert to Three.js coordinate system
        // In Three.js: +X = East, -X = West, +Y = Up, -Y = Down, +Z = South, -Z = North
        // SunCalc azimuth: 0 = South, π/2 = West, π = North, -π/2 = East
        // We need to rotate the azimuth by 180 degrees to match our coordinate system
        
        const distance = 500;
        
        // Convert spherical to Cartesian coordinates
        // Adding PI to azimuth to correct the orientation
        const adjustedAzimuth = azimuth + Math.PI;
        const x = distance * Math.sin(adjustedAzimuth) * Math.cos(altitude);
        const y = distance * Math.sin(altitude);
        const z = distance * Math.cos(adjustedAzimuth) * Math.cos(altitude);

        sunLightRef.current.position.set(x, y, z);
        sunLightRef.current.target.position.set(0, 0, 0);
        sunMeshRef.current.position.set(x, y, z);

        // Adjust light intensity based on sun altitude
        const altitudeDegrees = altitude * 180 / Math.PI;
        const intensity = altitude > 0 ? Math.max(0.3, Math.min(1.5, Math.sin(altitude) * 1.5)) : 0.05;
        sunLightRef.current.intensity = intensity;

        // Adjust light color based on sun altitude
        let lightColor = new THREE.Color(0xffffff);
        if (altitudeDegrees < 10 && altitudeDegrees > -5) {
            // Sunrise/sunset colors - orange/red
            const sunsetFactor = (10 - altitudeDegrees) / 15;
            lightColor = new THREE.Color().setHSL(0.05, 0.7 * sunsetFactor, 0.5 + 0.3 * (1 - sunsetFactor));
        } else if (altitudeDegrees < 0) {
            // Night time - bluish dim light (moonlight simulation)
            lightColor = new THREE.Color(0x4a5a8a);
        } else if (altitudeDegrees < 20) {
            // Early morning/late evening - warm yellow
            lightColor = new THREE.Color(0xffddaa);
        }

        sunLightRef.current.color = lightColor;
        (sunMeshRef.current.material as THREE.MeshBasicMaterial).color = lightColor;

        // Hide sun when significantly below horizon
        sunMeshRef.current.visible = altitudeDegrees > -5;

    }, [timeOfDay, latitude, longitude, date, month]);

    return (
        <>
            <directionalLight
                ref={sunLightRef}
                castShadow
                shadow-mapSize={[2048, 2048]}
                shadow-camera-left={-200}
                shadow-camera-right={200}
                shadow-camera-top={200}
                shadow-camera-bottom={-200}
                shadow-camera-near={0.5}
                shadow-camera-far={800}
                shadow-bias={-0.0001}
            />

            {/* Visual sun indicator */}
            <mesh ref={sunMeshRef}>
                <sphereGeometry args={[8, 16, 16]} />
                <meshBasicMaterial color="#FDB813" />
            </mesh>
        </>
    );
};

// North Indicator Component to show orientation
export const NorthIndicator: React.FC<{ size?: number }> = ({ size = 50 }) => {
    return (
        <group position={[0, 0.5, 0]}>
            {/* North Arrow - pointing towards -Z (North in Three.js with our coordinate system) */}
            <group position={[0, 0, -size]}>
                {/* Arrow shaft */}
                <mesh position={[0, 0, size / 2]}>
                    <cylinderGeometry args={[0.5, 0.5, size, 8]} />
                    <meshStandardMaterial color="#10b981" />
                </mesh>
                
                {/* Arrow head */}
                <mesh position={[0, 0, size]} rotation={[Math.PI, 0, 0]}>
                    <coneGeometry args={[2, 5, 8]} />
                    <meshStandardMaterial color="#10b981" />
                </mesh>
                
                {/* "N" label */}
                <mesh position={[0, 0, size + 8]}>
                    <sphereGeometry args={[3, 16, 16]} />
                    <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={0.5} />
                </mesh>
            </group>
            
            {/* Compass rose base */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
                <ringGeometry args={[size * 0.8, size * 0.9, 32]} />
                <meshStandardMaterial color="#666666" transparent opacity={0.5} />
            </mesh>
            
            {/* Cardinal direction markers */}
            {/* East (+X) */}
            <mesh position={[size * 0.85, 0, 0]}>
                <sphereGeometry args={[1.5, 16, 16]} />
                <meshStandardMaterial color="#888888" />
            </mesh>
            
            {/* West (-X) */}
            <mesh position={[-size * 0.85, 0, 0]}>
                <sphereGeometry args={[1.5, 16, 16]} />
                <meshStandardMaterial color="#888888" />
            </mesh>
            
            {/* South (+Z) */}
            <mesh position={[0, 0, size * 0.85]}>
                <sphereGeometry args={[1.5, 16, 16]} />
                <meshStandardMaterial color="#888888" />
            </mesh>
        </group>
    );
};
