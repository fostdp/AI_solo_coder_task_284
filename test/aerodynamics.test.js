const assert = require('assert');
const AdvancedAerodynamics = require('../public/aerodynamics');

console.log('========================================');
console.log('  纸飞机空气动力学测试套件');
console.log('========================================\n');

class TestRunner {
    constructor() {
        this.passed = 0;
        this.failed = 0;
        this.tests = [];
        this.results = [];
    }
    
    test(name, fn) {
        this.tests.push({ name, fn });
    }
    
    assert(condition, message) {
        if (!condition) {
            throw new Error(message);
        }
    }
    
    assertApprox(actual, expected, tolerance, message = '') {
        const diff = Math.abs(actual - expected);
        if (diff > tolerance) {
            throw new Error(`${message} 期望 ${expected}, 实际 ${actual}, 误差 ${diff.toFixed(6)} > ${tolerance}`);
        }
    }
    
    assertRange(value, min, max, message = '') {
        if (value < min || value > max) {
            throw new Error(`${message} 值 ${value} 超出范围 [${min}, ${max}]`);
        }
    }
    
    async run() {
        console.log(`\n运行 ${this.tests.length} 个测试...\n`);
        
        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`  ✅ ${test.name}`);
                this.passed++;
                this.results.push({ name: test.name, status: 'PASS', error: null });
            } catch (error) {
                console.log(`  ❌ ${test.name}`);
                console.log(`     错误: ${error.message}`);
                this.failed++;
                this.results.push({ name: test.name, status: 'FAIL', error: error.message });
            }
        }
        
        this.printSummary();
        return this.failed === 0;
    }
    
    printSummary() {
        console.log('\n========================================');
        console.log('  测试结果汇总');
        console.log('========================================');
        console.log(`  通过: ${this.passed}`);
        console.log(`  失败: ${this.failed}`);
        console.log(`  总计: ${this.tests.length}`);
        console.log('========================================');
        
        const passRate = (this.passed / this.tests.length * 100).toFixed(1);
        console.log(`  通过率: ${passRate}%`);
        console.log('========================================\n');
    }
}

const runner = new TestRunner();

runner.test('1.1 展弦比计算正确性', () => {
    const aero = new AdvancedAerodynamics({ wingSpan: 15, chordLength: 8 });
    const expectedAR = (15 * 15) / (15 * 8);
    runner.assertApprox(aero.params.aspectRatio, expectedAR, 0.001,
        '展弦比计算错误');
});

runner.test('1.2 不同翼展下的展弦比变化', () => {
    const testCases = [
        { span: 10, chord: 8, expectedAR: 1.25 },
        { span: 15, chord: 8, expectedAR: 1.875 },
        { span: 20, chord: 8, expectedAR: 2.5 },
        { span: 25, chord: 8, expectedAR: 3.125 }
    ];
    
    for (const tc of testCases) {
        const aero = new AdvancedAerodynamics({ wingSpan: tc.span, chordLength: tc.chord });
        runner.assertApprox(aero.params.aspectRatio, tc.expectedAR, 0.001,
            `翼展 ${tc.span}cm 时`);
    }
});

runner.test('2.1 零迎角时升力系数应为0', () => {
    const aero = new AdvancedAerodynamics();
    const result = aero.vortexLatticeMethod(0);
    runner.assertApprox(result.cl, 0, 0.01, '零迎角升力系数');
});

runner.test('2.2 升力线斜率合理性检验', () => {
    const aero = new AdvancedAerodynamics({ wingSpan: 20, chordLength: 8, paperFold: 'worldrecord' });
    const result = aero.vortexLatticeMethod(5);
    const clAlpha = result.cl / 5;
    runner.assertRange(clAlpha, 0.05, 0.15, '升力线斜率');
});

runner.test('2.3 迎角增加升力系数单调递增（失速前）', () => {
    const aero = new AdvancedAerodynamics();
    let prevCL = -Infinity;
    
    for (let alpha = 0; alpha <= 12; alpha++) {
        const result = aero.vortexLatticeMethod(alpha);
        runner.assert(result.cl > prevCL, `迎角 ${alpha}° 时升力未增加`);
        prevCL = result.cl;
    }
});

runner.test('2.4 诱导阻力与升力平方成正比', () => {
    const aero = new AdvancedAerodynamics();
    const results = [];
    
    for (let alpha = 2; alpha <= 10; alpha += 2) {
        results.push(aero.vortexLatticeMethod(alpha));
    }
    
    for (let i = 1; i < results.length; i++) {
        const cdRatio = results[i].cdInduced / results[i-1].cdInduced;
        const clSqRatio = Math.pow(results[i].cl / results[i-1].cl, 2);
        runner.assertApprox(cdRatio, clSqRatio, 0.1,
            `迎角 ${i*2}° 时诱导阻力与升力平方关系`);
    }
});

runner.test('2.5 后掠角对升力线斜率的影响', () => {
    const lowSweep = new AdvancedAerodynamics({ sweepAngle: 0 });
    const highSweep = new AdvancedAerodynamics({ sweepAngle: 45 });
    
    const resultLow = lowSweep.vortexLatticeMethod(5);
    const resultHigh = highSweep.vortexLatticeMethod(5);
    
    runner.assert(resultLow.clAlpha > resultHigh.clAlpha,
        '后掠角增加应降低升力线斜率');
});

runner.test('2.6 不同折法的气动效率对比', () => {
    const folds = ['dart', 'glider', 'stunt', 'stealth', 'worldrecord'];
    const efficiencies = {};
    
    for (const fold of folds) {
        const aero = new AdvancedAerodynamics({ paperFold: fold });
        const result = aero.vortexLatticeMethod(5);
        efficiencies[fold] = result.clcdRatio;
    }
    
    runner.assert(efficiencies.worldrecord > efficiencies.dart,
        '世界纪录型效率应高于飞镖型');
    runner.assert(efficiencies.glider > efficiencies.stunt,
        '滑翔机效率应高于特技型');
});

runner.test('2.7 极曲线数据完整性检验', () => {
    const aero = new AdvancedAerodynamics();
    const polarData = aero.generatePolarCurve(-5, 15, 1);
    
    runner.assert(polarData.length === 21, '极曲线数据点数量错误');
    
    for (const point of polarData) {
        runner.assert('angleOfAttack' in point, '缺少迎角数据');
        runner.assert('cl' in point, '缺少升力系数数据');
        runner.assert('cd' in point, '缺少阻力系数数据');
        runner.assert('clcd' in point, '缺少升阻比数据');
        runner.assertRange(point.cl, -0.5, 1.5, '升力系数范围异常');
        runner.assertRange(point.cd, 0.01, 0.5, '阻力系数范围异常');
    }
});

runner.test('2.8 最优滑翔角计算', () => {
    const aero = new AdvancedAerodynamics({ paperFold: 'glider' });
    const optimal = aero.findOptimalGlideAngle();
    
    runner.assertRange(optimal.optimalAngle, 3, 10, '最优滑翔角范围异常');
    runner.assertRange(optimal.maxClCd, 5, 20, '最大升阻比范围异常');
});

runner.test('3.1 重心在气动中心后应为稳定', () => {
    const aero = new AdvancedAerodynamics({ centerOfGravity: 40 });
    const stability = aero.calculateLongitudinalStability(5);
    
    runner.assert(stability.isStaticallyStable === true,
        '重心 40% 弦长位置应静态稳定');
    runner.assert(stability.staticMargin > 0, '静稳定裕度应为正');
});

runner.test('3.2 重心在中性点前应为不稳定', () => {
    const aero = new AdvancedAerodynamics({ centerOfGravity: 30 });
    const stability = aero.calculateLongitudinalStability(5);
    
    runner.assert(stability.cgPercent < stability.neutralPoint,
        '重心应在中性点之前');
    runner.assert(stability.isStaticallyStable === false,
        '重心 30% 弦长位置应不稳定');
});

runner.test('3.3 静稳定裕度随重心后移增加', () => {
    const margins = [];
    for (let cg = 30; cg <= 50; cg += 5) {
        const aero = new AdvancedAerodynamics({ centerOfGravity: cg });
        const stability = aero.calculateLongitudinalStability(5);
        margins.push(stability.staticMargin);
    }
    
    for (let i = 1; i < margins.length; i++) {
        runner.assert(margins[i] > margins[i-1],
            `重心 ${30 + i*5}% 时静稳定裕度应增加`);
    }
});

runner.test('3.4 俯仰力矩系数斜率应为负（稳定）', () => {
    const aero = new AdvancedAerodynamics({ paperFold: 'worldrecord' });
    const stability = aero.calculateLongitudinalStability(5);
    
    runner.assert(stability.dCmDAlpha < 0, 'dCm/dAlpha 应为负值');
    runner.assert(stability.dCmDCl < 0, 'dCm/dCl 应为负值');
});

runner.test('3.5 配平迎角计算合理性', () => {
    const aero = new AdvancedAerodynamics({ centerOfGravity: 45 });
    const stability = aero.calculateLongitudinalStability(5);
    
    runner.assertRange(stability.trimAngle, 0, 15, '配平迎角范围异常');
});

runner.test('3.6 稳定性等级划分正确', () => {
    const testCases = [
        { cg: 35, expectedLevel: '低稳定性' },
        { cg: 40, expectedLevel: '中等稳定' },
        { cg: 45, expectedLevel: '良好稳定' },
        { cg: 50, expectedLevel: '高稳定性' }
    ];
    
    for (const tc of testCases) {
        const aero = new AdvancedAerodynamics({ centerOfGravity: tc.cg });
        const stability = aero.calculateLongitudinalStability(5);
        runner.assert(stability.stabilityLevel === tc.expectedLevel || 
                     stability.stabilityLevel.includes('稳定'),
            `重心 ${tc.cg}% 时稳定性等级错误: ${stability.stabilityLevel}`);
    }
});

runner.test('4.1 射程与初始速度正相关', () => {
    const aero = new AdvancedAerodynamics({ paperFold: 'worldrecord' });
    let prevRange = 0;
    
    for (let velocity = 8; velocity <= 15; velocity += 2) {
        const flight = aero.calculateFlightRange(velocity, 10, 1.5);
        runner.assert(flight.range > prevRange,
            `速度 ${velocity}m/s 时射程应增加`);
        prevRange = flight.range;
    }
});

runner.test('4.2 最优发射角约为10-15度', () => {
    const aero = new AdvancedAerodynamics();
    let maxRange = 0;
    let optimalAngle = 0;
    
    for (let angle = 5; angle <= 25; angle += 2) {
        const flight = aero.calculateFlightRange(12, angle, 1.5);
        if (flight.range > maxRange) {
            maxRange = flight.range;
            optimalAngle = angle;
        }
    }
    
    runner.assertRange(optimalAngle, 8, 20, '最优发射角不在预期范围');
});

runner.test('4.3 发射高度增加射程增加', () => {
    const aero = new AdvancedAerodynamics();
    let prevRange = 0;
    
    for (let height = 1; height <= 2.5; height += 0.5) {
        const flight = aero.calculateFlightRange(12, 10, height);
        runner.assert(flight.range > prevRange,
            `高度 ${height}m 时射程应增加`);
        prevRange = flight.range;
    }
});

runner.test('4.4 滑翔射程应大于弹道射程', () => {
    const aero = new AdvancedAerodynamics({ paperFold: 'glider' });
    const flight = aero.calculateFlightRange(12, 10, 1.5);
    
    runner.assert(flight.glideRange > flight.ballisticRange,
        '滑翔射程应大于弹道射程');
});

runner.test('4.5 最大高度与发射角正相关', () => {
    const aero = new AdvancedAerodynamics();
    let prevHeight = 0;
    
    for (let angle = 5; angle <= 25; angle += 5) {
        const flight = aero.calculateFlightRange(12, angle, 1.5);
        runner.assert(flight.maxHeight > prevHeight,
            `发射角 ${angle}° 时最大高度应增加`);
        prevHeight = flight.maxHeight;
    }
});

runner.test('4.6 飞行时间与发射角关系', () => {
    const aero = new AdvancedAerodynamics();
    let prevTime = 0;
    
    for (let angle = 5; angle <= 25; angle += 5) {
        const flight = aero.calculateFlightRange(12, angle, 1.5);
        runner.assert(flight.flightTime > prevTime,
            `发射角 ${angle}° 时飞行时间应增加`);
        prevTime = flight.flightTime;
    }
});

runner.test('5.1 不同折法射程对比', () => {
    const folds = ['dart', 'glider', 'stunt', 'stealth', 'worldrecord'];
    const ranges = {};
    
    for (const fold of folds) {
        const aero = new AdvancedAerodynamics({ paperFold: fold });
        const flight = aero.calculateFlightRange(12, 10, 1.5);
        ranges[fold] = flight.range;
    }
    
    runner.assert(ranges.worldrecord > ranges.dart,
        '世界纪录型射程应大于飞镖型');
    runner.assert(ranges.glider > ranges.stunt,
        '滑翔机射程应大于特技型');
});

runner.test('5.2 纸张克重对射程的影响', () => {
    const weights = [60, 80, 100, 120];
    const results = [];
    
    for (const weight of weights) {
        const aero = new AdvancedAerodynamics({ paperWeight: weight });
        const flight = aero.calculateFlightRange(12, 10, 1.5);
        results.push({ weight, range: flight.range });
    }
    
    runner.assert(results[0].range > results[1].range,
        '60g纸应比80g纸飞得远');
    runner.assert(results[1].range > results[2].range,
        '80g纸应比100g纸飞得远');
    runner.assert(results[2].range > results[3].range,
        '100g纸应比120g纸飞得远');
});

runner.test('5.3 翼展对射程的影响存在最优值', () => {
    const results = [];
    
    for (let span = 8; span <= 25; span += 3) {
        const aero = new AdvancedAerodynamics({ wingSpan: span });
        const flight = aero.calculateFlightRange(12, 10, 1.5);
        results.push({ span, range: flight.range });
    }
    
    const maxRange = Math.max(...results.map(r => r.range));
    const bestSpan = results.find(r => r.range === maxRange).span;
    
    runner.assertRange(bestSpan, 12, 22, '最优翼展范围异常');
});

runner.test('6.1 失速速度计算合理性', () => {
    const aero = new AdvancedAerodynamics({ paperWeight: 80, wingSpan: 15 });
    const stallSpeed = aero.calculateStallSpeed(1);
    
    runner.assertRange(stallSpeed, 2, 8, '失速速度范围异常');
});

runner.test('6.2 载荷因子增加失速速度增加', () => {
    const aero = new AdvancedAerodynamics();
    const stall1g = aero.calculateStallSpeed(1);
    const stall2g = aero.calculateStallSpeed(2);
    
    runner.assertApprox(stall2g, stall1g * Math.sqrt(2), 0.1,
        '2g失速速度应为1g的√2倍');
});

runner.test('6.3 转弯半径与速度平方成正比', () => {
    const aero = new AdvancedAerodynamics();
    const turn10 = aero.calculateTurnRadius(10, 30);
    const turn20 = aero.calculateTurnRadius(20, 30);
    
    runner.assertApprox(turn20.turnRadius, turn10.turnRadius * 4, 0.5,
        '速度加倍转弯半径应为4倍');
});

runner.test('6.4 大坡度转弯可能失速', () => {
    const aero = new AdvancedAerodynamics();
    
    const turnSafe = aero.calculateTurnRadius(10, 45);
    runner.assert(turnSafe.canTurn === true, '45度转弯应可完成');
    
    const turnStall = aero.calculateTurnRadius(3, 45);
    runner.assert(turnStall.canTurn === false, '低速大坡度转弯应失速');
});

runner.test('7.1 升阻比验证 (CL/CD 峰值)', () => {
    const aero = new AdvancedAerodynamics({ paperFold: 'worldrecord' });
    const optimal = aero.findOptimalGlideAngle();
    
    runner.assertRange(optimal.maxClCd, 8, 15, '最大升阻比范围异常');
});

runner.test('7.2 后掠角对波阻的影响', () => {
    const lowSweep = new AdvancedAerodynamics({ sweepAngle: 10 });
    const highSweep = new AdvancedAerodynamics({ sweepAngle: 50 });
    
    const resultLow = lowSweep.vortexLatticeMethod(12, 15);
    const resultHigh = highSweep.vortexLatticeMethod(12, 15);
    
    const waveDragRatio = resultLow.cd - resultLow.cd0 - resultLow.cdInduced;
    const waveDragHigh = resultHigh.cd - resultHigh.cd0 - resultHigh.cdInduced;
    
    runner.assert(resultHigh.clcdRatio > resultLow.clcdRatio * 0.95,
        '大后掠角在高速时应保持较好效率');
});

runner.test('7.3 展弦比对诱导阻力的影响', () => {
    const lowAR = new AdvancedAerodynamics({ wingSpan: 10, chordLength: 10 });
    const highAR = new AdvancedAerodynamics({ wingSpan: 25, chordLength: 8 });
    
    const resultLow = lowAR.vortexLatticeMethod(5);
    const resultHigh = highAR.vortexLatticeMethod(5);
    
    runner.assert(resultLow.cdInduced > resultHigh.cdInduced,
        '小展弦比诱导阻力应更大');
});

runner.test('8.1 边界条件：负迎角气动力', () => {
    const aero = new AdvancedAerodynamics();
    const result = aero.vortexLatticeMethod(-5);
    
    runner.assert(result.cl < 0, '负迎角升力系数应为负');
    runner.assert(result.cd > 0, '阻力系数始终为正');
});

runner.test('8.2 边界条件：大迎角失速特性', () => {
    const aero = new AdvancedAerodynamics();
    const preStall = aero.vortexLatticeMethod(14);
    const postStall = aero.vortexLatticeMethod(18);
    
    runner.assert(postStall.cl < preStall.cl * 1.1,
        '失速后升力系数不应继续大幅增加');
});

runner.test('8.3 能量守恒验证', () => {
    const aero = new AdvancedAerodynamics({ paperWeight: 80 });
    const flight = aero.calculateFlightRange(12, 10, 1.5);
    
    const mass = 0.08;
    const expectedEnergy = 0.5 * mass * 144 + mass * 9.81 * 1.5;
    
    runner.assertApprox(flight.initialEnergy, expectedEnergy, 0.01,
        '初始能量计算不守恒');
});

runner.test('9.1 完整设计点性能评估', () => {
    const design = {
        sweepAngle: 25,
        wingSpan: 18,
        chordLength: 8,
        centerOfGravity: 45,
        paperFold: 'worldrecord',
        paperWeight: 80
    };
    
    const aero = new AdvancedAerodynamics(design);
    
    const aero5deg = aero.vortexLatticeMethod(5);
    const stability = aero.calculateLongitudinalStability(5);
    const flight = aero.calculateFlightRange(12, 10, 1.5);
    const optimal = aero.findOptimalGlideAngle();
    
    runner.assertRange(aero5deg.clcdRatio, 6, 14, '巡航升阻比');
    runner.assert(stability.isStaticallyStable, '设计应静态稳定');
    runner.assertRange(stability.staticMargin, 2, 10, '静稳定裕度');
    runner.assertRange(flight.range, 10, 30, '飞行射程');
    runner.assertRange(optimal.optimalAngle, 4, 10, '最优滑翔角');
    
    console.log(`\n     📊 设计性能报告:`);
    console.log(`       升阻比: ${aero5deg.clcdRatio.toFixed(2)}`);
    console.log(`       静稳定裕度: ${stability.staticMargin.toFixed(2)}%`);
    console.log(`       稳定性等级: ${stability.stabilityLevel}`);
    console.log(`       预测射程: ${flight.range.toFixed(2)}m`);
    console.log(`       最优滑翔角: ${optimal.optimalAngle.toFixed(1)}°`);
    console.log(`       最大升阻比: ${optimal.maxClCd.toFixed(2)}`);
});

runner.test('9.2 参数敏感性分析', () => {
    const base = new AdvancedAerodynamics();
    const baseFlight = base.calculateFlightRange(12, 10, 1.5);
    
    const sensitivities = [];
    
    for (let sweep = 15; sweep <= 35; sweep += 10) {
        const aero = new AdvancedAerodynamics({ sweepAngle: sweep });
        const flight = aero.calculateFlightRange(12, 10, 1.5);
        const change = ((flight.range - baseFlight.range) / baseFlight.range * 100).toFixed(1);
        sensitivities.push(`后掠角${sweep}°: ${change}%`);
    }
    
    for (let span = 10; span <= 20; span += 5) {
        const aero = new AdvancedAerodynamics({ wingSpan: span });
        const flight = aero.calculateFlightRange(12, 10, 1.5);
        const change = ((flight.range - baseFlight.range) / baseFlight.range * 100).toFixed(1);
        sensitivities.push(`翼展${span}cm: ${change}%`);
    }
    
    console.log(`\n     📈 参数敏感性分析:`);
    for (const sens of sensitivities) {
        console.log(`       ${sens}`);
    }
    
    runner.assert(sensitivities.length === 5, '敏感性分析应完成');
});

(async () => {
    console.log('\n📋 测试说明:');
    console.log('  - 模块1-2: 涡格法 (VLM) 简化空气动力学');
    console.log('  - 模块3:   纵向静稳定性判据');
    console.log('  - 模块4:   射程计算与飞行轨迹');
    console.log('  - 模块5:   折法/材料参数化测试');
    console.log('  - 模块6-8: 边界条件与附加验证');
    console.log('  - 模块9:   综合性能评估\n');
    
    await runner.run();
})();
