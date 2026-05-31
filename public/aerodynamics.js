class AdvancedAerodynamics {
    constructor(params = {}) {
        this.params = {
            sweepAngle: params.sweepAngle || 25,
            wingSpan: params.wingSpan || 15,
            chordLength: params.chordLength || 8,
            centerOfGravity: params.centerOfGravity || 45,
            paperFold: params.paperFold || 'dart',
            paperWeight: params.paperWeight || 80,
            aspectRatio: params.aspectRatio || null
        };
        
        this.foldFactors = {
            dart: { cd0: 0.035, clAlpha: 0.085, efficiency: 0.85, cmAlpha: -0.015 },
            glider: { cd0: 0.025, clAlpha: 0.095, efficiency: 0.92, cmAlpha: -0.012 },
            stunt: { cd0: 0.045, clAlpha: 0.075, efficiency: 0.78, cmAlpha: -0.018 },
            stealth: { cd0: 0.020, clAlpha: 0.080, efficiency: 0.88, cmAlpha: -0.010 },
            worldrecord: { cd0: 0.018, clAlpha: 0.100, efficiency: 0.95, cmAlpha: -0.008 }
        };
        
        this.calculateAspectRatio();
    }
    
    calculateAspectRatio() {
        const wingArea = this.params.wingSpan * this.params.chordLength;
        this.params.aspectRatio = (this.params.wingSpan * this.params.wingSpan) / wingArea;
    }
    
    vortexLatticeMethod(angleOfAttack, velocity = 10) {
        const AR = this.params.aspectRatio;
        const sweepRad = this.params.sweepAngle * Math.PI / 180;
        const fold = this.foldFactors[this.params.paperFold];
        const beta = Math.sqrt(1 - Math.pow(0.3, 2));
        
        const clAlpha3D = (2 * Math.PI * AR) / (2 + Math.sqrt(4 + Math.pow(AR * beta / fold.efficiency, 2) * (1 + Math.pow(Math.tan(sweepRad) / beta, 2))));
        const clAlphaPerDegree = clAlpha3D * (Math.PI / 180) * fold.clAlpha * 10;
        
        const cl = clAlphaPerDegree * angleOfAttack;
        const clMax = 1.2;
        const stallAngle = 15;
        
        const effectiveCL = angleOfAttack <= stallAngle ? 
            cl * (1 - 0.3 * Math.pow(angleOfAttack / stallAngle, 2)) :
            clMax * Math.exp(-Math.pow((angleOfAttack - stallAngle) / 5, 2));
        
        const cdInduced = Math.pow(effectiveCL, 2) / (Math.PI * AR * fold.efficiency);
        const cdWave = angleOfAttack > 10 ? 0.005 * Math.pow((angleOfAttack - 10) / 5, 2) : 0;
        const cd = fold.cd0 + cdInduced + cdWave;
        
        const cm = fold.cmAlpha * angleOfAttack;
        
        const dynamicPressure = 0.5 * 1.225 * velocity * velocity;
        const wingArea = (this.params.wingSpan * this.params.chordLength) / 10000;
        const lift = dynamicPressure * wingArea * effectiveCL;
        const drag = dynamicPressure * wingArea * cd;
        const moment = dynamicPressure * wingArea * this.params.chordLength * cm / 100;
        
        return {
            cl: effectiveCL,
            cd: cd,
            clcdRatio: effectiveCL / cd,
            cm: cm,
            lift: lift,
            drag: drag,
            moment: moment,
            clAlpha: clAlphaPerDegree,
            cd0: fold.cd0,
            cdInduced: cdInduced
        };
    }
    
    calculateLongitudinalStability(angleOfAttack = 5) {
        const aero = this.vortexLatticeMethod(angleOfAttack);
        const cgPercent = this.params.centerOfGravity;
        const chord = this.params.chordLength;
        
        const aerodynamicCenter = 25;
        const neutralPoint = aerodynamicCenter + (0.5 * (this.params.aspectRatio / 6));
        const staticMargin = neutralPoint - cgPercent;
        
        const cmAC = aero.cm - (aero.cl * (cgPercent - aerodynamicCenter) / 100);
        const dCmDAlpha = this.foldFactors[this.params.paperFold].cmAlpha;
        const dCmDCl = dCmDAlpha / aero.clAlpha;
        
        const isStaticallyStable = staticMargin > 0 && dCmDCl < 0;
        
        const stabilityLevel = staticMargin < 2 ? '低稳定性' :
                                staticMargin < 5 ? '中等稳定' :
                                staticMargin < 10 ? '良好稳定' : '高稳定性';
        
        const trimAngle = Math.abs(cmAC / dCmDAlpha);
        
        return {
            staticMargin: staticMargin,
            neutralPoint: neutralPoint,
            aerodynamicCenter: aerodynamicCenter,
            dCmDAlpha: dCmDAlpha,
            dCmDCl: dCmDCl,
            cmAC: cmAC,
            isStaticallyStable: isStaticallyStable,
            stabilityLevel: stabilityLevel,
            trimAngle: trimAngle,
            cgPercent: cgPercent
        };
    }
    
    calculateFlightRange(initialVelocity = 12, launchAngle = 10, initialHeight = 1.5) {
        const gravity = 9.81;
        const mass = this.params.paperWeight / 1000;
        const wingArea = (this.params.wingSpan * this.params.chordLength) / 10000;
        
        const glideAngle = Math.atan(1 / 8) * 180 / Math.PI;
        const bestGlideAngle = Math.min(glideAngle, launchAngle + 5);
        
        const aeroCruise = this.vortexLatticeMethod(bestGlideAngle, initialVelocity);
        const liftToDrag = aeroCruise.clcdRatio;
        
        const kineticEnergy = 0.5 * mass * initialVelocity * initialVelocity;
        const potentialEnergy = mass * gravity * initialHeight;
        const totalEnergy = kineticEnergy + potentialEnergy;
        
        const avgDrag = 0.5 * 1.225 * wingArea * aeroCruise.cd * initialVelocity * initialVelocity * 0.7;
        const workAgainstDrag = avgDrag;
        
        const glideRange = (liftToDrag * (initialHeight + initialVelocity * initialVelocity / (2 * gravity))) * 0.85;
        const horizontalVelocity = initialVelocity * Math.cos(launchAngle * Math.PI / 180);
        const verticalVelocity = initialVelocity * Math.sin(launchAngle * Math.PI / 180);
        
        const timeToApogee = verticalVelocity / gravity;
        const apogeeHeight = initialHeight + verticalVelocity * timeToApogee - 0.5 * gravity * timeToApogee * timeToApogee;
        
        const timeFromApogee = Math.sqrt(2 * apogeeHeight / gravity);
        const glideDistanceFromApogee = horizontalVelocity * timeFromApogee * (1 - 0.3 * (1 - liftToDrag / 10));
        
        const ballisticRange = (initialVelocity * initialVelocity * Math.sin(2 * launchAngle * Math.PI / 180)) / gravity;
        const finalRange = (ballisticRange * 0.3 + glideRange * 0.7) * this.getMaterialFactor();
        
        const flightTime = timeToApogee + timeFromApogee;
        const maxHeight = apogeeHeight;
        const avgSpeed = finalRange / flightTime;
        
        return {
            range: parseFloat(finalRange.toFixed(3)),
            maxHeight: parseFloat(maxHeight.toFixed(3)),
            flightTime: parseFloat(flightTime.toFixed(2)),
            avgSpeed: parseFloat(avgSpeed.toFixed(2)),
            liftToDragRatio: parseFloat(liftToDrag.toFixed(2)),
            ballisticRange: parseFloat(ballisticRange.toFixed(3)),
            glideRange: parseFloat(glideRange.toFixed(3)),
            bestGlideAngle: parseFloat(bestGlideAngle.toFixed(2)),
            initialEnergy: parseFloat(totalEnergy.toFixed(4))
        };
    }
    
    getMaterialFactor() {
        const weight = this.params.paperWeight;
        if (weight <= 60) return 1.15;
        if (weight <= 80) return 1.0;
        if (weight <= 100) return 0.92;
        return 0.85;
    }
    
    generatePolarCurve(minAngle = -10, maxAngle = 20, step = 1) {
        const polarData = [];
        for (let alpha = minAngle; alpha <= maxAngle; alpha += step) {
            const aero = this.vortexLatticeMethod(alpha);
            polarData.push({
                angleOfAttack: alpha,
                cl: parseFloat(aero.cl.toFixed(4)),
                cd: parseFloat(aero.cd.toFixed(4)),
                clcd: parseFloat(aero.clcdRatio.toFixed(2)),
                cm: parseFloat(aero.cm.toFixed(4))
            });
        }
        return polarData;
    }
    
    findOptimalGlideAngle() {
        let maxClCd = 0;
        let optimalAngle = 0;
        for (let alpha = 1; alpha <= 15; alpha += 0.5) {
            const aero = this.vortexLatticeMethod(alpha);
            if (aero.clcdRatio > maxClCd) {
                maxClCd = aero.clcdRatio;
                optimalAngle = alpha;
            }
        }
        return { optimalAngle, maxClCd: parseFloat(maxClCd.toFixed(2)) };
    }
    
    calculateStallSpeed(loadFactor = 1) {
        const mass = this.params.paperWeight / 1000;
        const wingArea = (this.params.wingSpan * this.params.chordLength) / 10000;
        const clMax = 1.2;
        const stallSpeed = Math.sqrt((2 * mass * 9.81 * loadFactor) / (1.225 * wingArea * clMax));
        return parseFloat(stallSpeed.toFixed(2));
    }
    
    calculateTurnRadius(velocity, bankAngle) {
        const loadFactor = 1 / Math.cos(bankAngle * Math.PI / 180);
        const stallSpeed = this.calculateStallSpeed(loadFactor);
        const turnRadius = velocity * velocity / (9.81 * Math.tan(bankAngle * Math.PI / 180));
        return {
            turnRadius: parseFloat(turnRadius.toFixed(2)),
            loadFactor: parseFloat(loadFactor.toFixed(2)),
            stallSpeed: stallSpeed,
            canTurn: velocity > stallSpeed
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdvancedAerodynamics;
}
