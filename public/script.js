class PaperPlaneGame {
    constructor() {
        this.canvas = document.getElementById('simulationCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.mode = 'design';
        this.isFlying = false;
        this.currentDesignId = null;
        this.currentCompetitionId = null;
        
        this.foldTemplates = {
            dart: { name: '飞镖型', dragFactor: 0.85, liftFactor: 1.0, stabilityFactor: 1.1 },
            glider: { name: '滑翔机', dragFactor: 0.75, liftFactor: 1.2, stabilityFactor: 0.9 },
            stunt: { name: '特技型', dragFactor: 1.0, liftFactor: 0.9, stabilityFactor: 1.3 },
            stealth: { name: '隐身型', dragFactor: 0.7, liftFactor: 0.85, stabilityFactor: 1.0 },
            worldrecord: { name: '纪录型', dragFactor: 0.65, liftFactor: 1.15, stabilityFactor: 1.2 }
        };
        
        this.windStrengths = {
            calm: { turbulence: 0.1, crosswind: 0.05 },
            light: { turbulence: 0.3, crosswind: 0.15 },
            moderate: { turbulence: 0.6, crosswind: 0.3 },
            strong: { turbulence: 1.0, crosswind: 0.5 }
        };
        
        this.params = {
            sweepAngle: 30,
            wingSpan: 15,
            centerOfGravity: 50,
            paperFold: 'dart',
            paperWeight: 80,
            windStrength: 'moderate'
        };
        
        this.results = {
            liftToDragRatio: 0,
            stability: 0,
            distance: 0,
            maxHeight: 0,
            avgSpeed: 0,
            glideRatio: 0,
            windEffect: 0
        };
        
        this.planeState = {
            x: 50,
            y: 280,
            velocityX: 0,
            velocityY: 0,
            angle: 0,
            angularVelocity: 0,
            maxHeight: 0,
            totalDistance: 0,
            speedSum: 0,
            frameCount: 0
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.drawPlane();
        this.loadLeaderboard();
        this.loadCompetitions();
        this.checkSharedDesign();
    }
    
    checkSharedDesign() {
        const urlParams = new URLSearchParams(window.location.search);
        const shareId = urlParams.get('share');
        if (shareId) {
            this.loadSharedDesign(shareId);
        }
    }
    
    setupEventListeners() {
        document.getElementById('sweepAngle').addEventListener('input', (e) => {
            this.params.sweepAngle = parseInt(e.target.value);
            document.getElementById('sweepAngleValue').textContent = this.params.sweepAngle;
            if (this.mode === 'design') {
                this.drawPlane();
            }
        });
        
        document.getElementById('wingSpan').addEventListener('input', (e) => {
            this.params.wingSpan = parseInt(e.target.value);
            document.getElementById('wingSpanValue').textContent = this.params.wingSpan;
            if (this.mode === 'design') {
                this.drawPlane();
            }
        });
        
        document.getElementById('centerOfGravity').addEventListener('input', (e) => {
            this.params.centerOfGravity = parseInt(e.target.value);
            document.getElementById('centerOfGravityValue').textContent = this.params.centerOfGravity;
            if (this.mode === 'design') {
                this.drawPlane();
            }
        });
        
        document.getElementById('windStrength').addEventListener('change', (e) => {
            this.params.windStrength = e.target.value;
        });
        
        document.querySelectorAll('.fold-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.fold-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.params.paperFold = e.currentTarget.dataset.fold;
                if (this.mode === 'design') {
                    this.drawPlane();
                }
            });
        });
        
        document.querySelectorAll('.paper-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.paper-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                this.params.paperWeight = parseInt(e.currentTarget.dataset.weight);
            });
        });
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                const tab = e.currentTarget.dataset.tab;
                document.getElementById('leaderboardTab').style.display = tab === 'leaderboard' ? 'block' : 'none';
                document.getElementById('competitionsTab').style.display = tab === 'competitions' ? 'block' : 'none';
            });
        });
        
        document.getElementById('windTunnelBtn').addEventListener('click', () => this.runWindTunnel());
        document.getElementById('flyBtn').addEventListener('click', () => this.startFlight());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveDesign());
        document.getElementById('shareBtn').addEventListener('click', () => this.openShareModal());
        document.getElementById('refreshLeaderboard').addEventListener('click', () => this.loadLeaderboard());
        document.getElementById('createCompetitionBtn').addEventListener('click', () => this.createCompetition());
        document.getElementById('joinCompetitionBtn').addEventListener('click', () => this.openCompetitionModal());
        document.getElementById('backToListBtn').addEventListener('click', () => this.backToCompetitionList());
        document.getElementById('confirmJoinBtn').addEventListener('click', () => this.joinCompetition());
        document.getElementById('refreshCompetitionRank').addEventListener('click', () => {
            if (this.currentCompetitionId) {
                this.loadCompetitionLeaderboard(this.currentCompetitionId, true);
            }
        });
        
        document.querySelector('.close-btn').addEventListener('click', () => {
            document.getElementById('shareModal').style.display = 'none';
        });
        
        document.querySelector('.close-competition').addEventListener('click', () => {
            document.getElementById('competitionModal').style.display = 'none';
        });
        
        document.getElementById('copyLinkBtn').addEventListener('click', () => {
            const linkInput = document.getElementById('shareLink');
            linkInput.select();
            document.execCommand('copy');
            document.getElementById('copyLinkBtn').textContent = '✓ 已复制';
            setTimeout(() => {
                document.getElementById('copyLinkBtn').textContent = '📋 复制';
            }, 2000);
        });
        
        window.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
    }
    
    calculateAerodynamics() {
        const { sweepAngle, wingSpan, centerOfGravity, paperFold, paperWeight, windStrength } = this.params;
        
        const fold = this.foldTemplates[paperFold];
        const weightFactor = 80 / paperWeight;
        
        const optimalSweep = 25;
        const sweepEffect = Math.max(0, 1 - Math.abs(sweepAngle - optimalSweep) / 50);
        
        const spanEffect = wingSpan / 15;
        const dragIncrease = Math.pow(wingSpan / 15, 1.5);
        const lift = sweepEffect * spanEffect * fold.liftFactor * 8;
        const drag = (0.5 + (sweepAngle / 100)) * dragIncrease * fold.dragFactor;
        const liftToDragRatio = (lift / drag) * weightFactor;
        
        const optimalCG = 45;
        const cgDeviation = Math.abs(centerOfGravity - optimalCG);
        const stability = Math.max(0, 10 - cgDeviation / 2.5) * fold.stabilityFactor;
        
        return {
            liftToDragRatio: parseFloat(liftToDragRatio.toFixed(2)),
            stability: parseFloat(stability.toFixed(1)),
            lift,
            drag
        };
    }
    
    runWindTunnel() {
        if (this.isFlying) return;
        
        this.mode = 'windtunnel';
        document.getElementById('modeIndicator').textContent = '风洞测试';
        
        const aerodynamics = this.calculateAerodynamics();
        this.results.liftToDragRatio = aerodynamics.liftToDragRatio;
        this.results.stability = aerodynamics.stability;
        
        document.getElementById('liftDragRatio').textContent = aerodynamics.liftToDragRatio;
        document.getElementById('stability').textContent = aerodynamics.stability;
        
        let frame = 0;
        const animate = () => {
            frame++;
            this.drawWindTunnel(frame);
            if (frame < 120) {
                requestAnimationFrame(animate);
            } else {
                this.mode = 'design';
                document.getElementById('modeIndicator').textContent = '设计模式';
                this.drawPlane();
            }
        };
        animate();
    }
    
    drawWindTunnel(frame) {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawSky();
        this.drawGround();
        
        const wind = this.windStrengths[this.params.windStrength];
        const windIntensity = Math.sin(frame * 0.1) * 0.5 + 0.5;
        
        const baseSpeed = 3 + wind.turbulence * 2;
        const maxCrossOffset = wind.crosswind * 15;
        
        ctx.strokeStyle = `rgba(100, 200, 255, ${0.3 + windIntensity * 0.3})`;
        ctx.lineWidth = 2;
        
        for (let i = 0; i < 15; i++) {
            const y = 50 + i * 25;
            const localPhase = (frame * baseSpeed + i * 40) % 700;
            const offset = localPhase - 100;
            
            const crossWave = Math.sin((frame * 0.03 + i * 0.3) * Math.PI);
            const crossOffset = crossWave * maxCrossOffset;
            
            if (offset > -60 && offset < this.canvas.width + 10) {
                ctx.beginPath();
                ctx.moveTo(offset - 30, y);
                ctx.lineTo(offset, y + crossOffset);
                ctx.lineTo(offset - 10, y + crossOffset - 5);
                ctx.moveTo(offset, y + crossOffset);
                ctx.lineTo(offset - 10, y + crossOffset + 5);
                ctx.stroke();
            }
        }
        
        this.drawPlane();
    }
    
    checkStabilityWarning() {
        const warnings = [];
        
        if (this.params.centerOfGravity > 55) {
            warnings.push('⚠️ 重心过于靠后! 可能导致严重不稳定');
        } else if (this.params.centerOfGravity > 50) {
            warnings.push('⚠️ 重心偏后，飞行稳定性降低');
        }
        
        const aerodynamics = this.calculateAerodynamics();
        if (aerodynamics.stability < 3) {
            warnings.push('⚠️ 稳定性极低! 极易失速坠毁');
        } else if (aerodynamics.stability < 5) {
            warnings.push('⚠️ 稳定性较低，小心操作');
        }
        
        return warnings;
    }
    
    startFlight() {
        if (this.isFlying) return;
        
        const warnings = this.checkStabilityWarning();
        if (warnings.length > 0) {
            const confirmMessage = warnings.join('\n') + '\n\n是否继续试飞?';
            if (!confirm(confirmMessage)) {
                return;
            }
        }
        
        const aerodynamics = this.calculateAerodynamics();
        this.results.liftToDragRatio = aerodynamics.liftToDragRatio;
        this.results.stability = aerodynamics.stability;
        
        document.getElementById('liftDragRatio').textContent = aerodynamics.liftToDragRatio;
        document.getElementById('stability').textContent = aerodynamics.stability;
        
        this.mode = 'flight';
        this.isFlying = true;
        this.stallCount = 0;
        this.stallWarningShown = false;
        document.getElementById('modeIndicator').textContent = '试飞中...';
        document.getElementById('flightStats').style.display = 'none';
        
        document.getElementById('windTunnelBtn').disabled = true;
        document.getElementById('flyBtn').disabled = true;
        document.getElementById('saveBtn').disabled = true;
        document.getElementById('shareBtn').disabled = true;
        
        const weightFactor = 80 / this.params.paperWeight;
        const fold = this.foldTemplates[this.params.paperFold];
        
        this.planeState = {
            x: 50,
            y: 280,
            velocityX: (3 + this.results.liftToDragRatio * 0.3) * weightFactor * 0.9,
            velocityY: -1.5,
            angle: -5,
            angularVelocity: 0,
            maxHeight: 0,
            totalDistance: 0,
            speedSum: 0,
            frameCount: 0
        };
        
        this.animateFlight();
    }
    
    animateFlight() {
        const ctx = this.ctx;
        const { liftToDragRatio, stability } = this.results;
        const state = this.planeState;
        const wind = this.windStrengths[this.params.windStrength];
        const weightFactor = this.params.paperWeight / 80;
        
        const gravity = 0.08 * weightFactor;
        const lift = gravity * (liftToDragRatio / 8) * Math.max(0, state.velocityX);
        const drag = 0.005 * state.velocityX * state.velocityX;
        
        const cgEffect = (this.params.centerOfGravity - 50) / 100;
        const stabilityTorque = -cgEffect * 0.02 * state.velocityX;
        const damping = -0.05 * state.angularVelocity;
        
        const turbulence = (Math.random() - 0.5) * wind.turbulence * (10 - stability) * 0.02;
        const crosswindForce = (Math.random() - 0.3) * wind.crosswind * 0.15 * state.velocityX;
        
        state.velocityY += gravity - lift * 0.1 + crosswindForce * 0.3;
        state.velocityX -= drag * 0.3;
        state.angularVelocity += stabilityTorque + damping + turbulence;
        
        state.x += state.velocityX;
        state.y += state.velocityY;
        state.angle += state.angularVelocity;
        
        state.angle = Math.max(-45, Math.min(45, state.angle));
        
        const angleOfAttack = Math.abs(state.angle);
        const isStalling = angleOfAttack > 25 || (angleOfAttack > 15 && state.velocityX < 2);
        
        if (isStalling) {
            this.stallCount++;
            if (this.stallCount > 30 && !this.stallWarningShown) {
                document.getElementById('modeIndicator').textContent = '⚠️ 失速!';
                this.stallWarningShown = true;
            }
        } else {
            this.stallCount = Math.max(0, this.stallCount - 1);
            if (this.stallCount < 10 && this.stallWarningShown) {
                document.getElementById('modeIndicator').textContent = '试飞中...';
                this.stallWarningShown = false;
            }
        }
        
        state.maxHeight = Math.max(state.maxHeight, 350 - state.y);
        state.frameCount++;
        state.speedSum += state.velocityX;
        
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawSky();
        this.drawGround();
        
        const scale = this.params.wingSpan / 15;
        const planeX = Math.min(state.x, 400);
        const cameraOffset = Math.max(0, state.x - 400);
        
        ctx.save();
        ctx.translate(planeX, state.y);
        ctx.rotate(state.angle * Math.PI / 180);
        ctx.scale(scale, scale);
        this.drawPlaneShape();
        ctx.restore();
        
        this.drawTrail(state.x, state.y, cameraOffset);
        
        const distanceMeters = (state.x - 50) * 0.05;
        document.getElementById('distance').textContent = distanceMeters.toFixed(1);
        
        const crashed = state.y >= 350 || state.angle < -40 || state.angle > 40;
        const landed = state.y >= 350 && Math.abs(state.angle) < 15 && state.velocityX > 0.5;
        
        if (crashed || landed || state.velocityX < 0.5) {
            this.isFlying = false;
            this.results.distance = parseFloat(distanceMeters.toFixed(1));
            this.results.maxHeight = parseFloat((state.maxHeight * 0.05).toFixed(2));
            this.results.avgSpeed = parseFloat(((state.speedSum / state.frameCount) * 0.5).toFixed(2));
            this.results.glideRatio = parseFloat((distanceMeters / (state.maxHeight * 0.05 || 1)).toFixed(1));
            this.results.windEffect = parseFloat((wind.turbulence * 10).toFixed(1));
            
            document.getElementById('maxHeight').textContent = this.results.maxHeight;
            document.getElementById('avgSpeed').textContent = this.results.avgSpeed;
            document.getElementById('glideRatio').textContent = this.results.glideRatio;
            document.getElementById('windEffect').textContent = this.results.windEffect;
            document.getElementById('flightStats').style.display = 'block';
            
            if (landed) {
                document.getElementById('modeIndicator').textContent = '完美着陆!';
            } else if (crashed) {
                document.getElementById('modeIndicator').textContent = '坠毁!';
            } else {
                document.getElementById('modeIndicator').textContent = '滑翔结束';
            }
            
            setTimeout(() => {
                this.mode = 'design';
                document.getElementById('modeIndicator').textContent = '设计模式';
                document.getElementById('windTunnelBtn').disabled = false;
                document.getElementById('flyBtn').disabled = false;
                document.getElementById('saveBtn').disabled = false;
                document.getElementById('shareBtn').disabled = false;
                this.drawPlane();
            }, 2000);
        } else {
            this.animationId = requestAnimationFrame(() => this.animateFlight());
        }
    }
    
    drawTrail(x, y, offset) {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 20; i++) {
            const trailX = x - i * 5 - offset;
            const trailY = y + i * 2;
            if (i === 0) {
                ctx.moveTo(trailX, trailY);
            } else {
                ctx.lineTo(trailX, trailY);
            }
        }
        ctx.stroke();
    }
    
    drawPlane() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawSky();
        this.drawGround();
        
        const scale = this.params.wingSpan / 15;
        const centerX = 250;
        const centerY = 200;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.scale(scale, scale);
        
        const cgX = -30 + (this.params.centerOfGravity / 100) * 60;
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(cgX, 0, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'white';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('CG', cgX, -10);
        
        this.drawPlaneShape();
        ctx.restore();
    }
    
    drawPlaneShape() {
        const ctx = this.ctx;
        const sweepRad = this.params.sweepAngle * Math.PI / 180;
        const wingLength = 40;
        const fold = this.params.paperFold;
        
        let wingColor = '#ffffff';
        let bodyColor = '#333333';
        
        if (fold === 'dart') {
            wingColor = '#ff6b6b';
            bodyColor = '#c92a2a';
        } else if (fold === 'glider') {
            wingColor = '#4dabf7';
            bodyColor = '#1864ab';
        } else if (fold === 'stunt') {
            wingColor = '#51cf66';
            bodyColor = '#2b8a3e';
        } else if (fold === 'stealth') {
            wingColor = '#868e96';
            bodyColor = '#495057';
        } else if (fold === 'worldrecord') {
            wingColor = '#fcc419';
            bodyColor = '#e67700';
        }
        
        ctx.fillStyle = wingColor;
        ctx.strokeStyle = bodyColor;
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(30, 0);
        ctx.lineTo(-20, -8);
        ctx.lineTo(-30, 0);
        ctx.lineTo(-20, 8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-wingLength * Math.cos(sweepRad), -wingLength * Math.sin(sweepRad) - 15);
        ctx.lineTo(-wingLength * Math.cos(sweepRad) - 10, -wingLength * Math.sin(sweepRad) - 12);
        ctx.lineTo(0, -5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-wingLength * Math.cos(sweepRad), wingLength * Math.sin(sweepRad) + 15);
        ctx.lineTo(-wingLength * Math.cos(sweepRad) - 10, wingLength * Math.sin(sweepRad) + 12);
        ctx.lineTo(0, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-25, 0);
        ctx.lineTo(-35, -10);
        ctx.lineTo(-38, -8);
        ctx.lineTo(-30, 0);
        ctx.lineTo(-38, 8);
        ctx.lineTo(-35, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    drawSky() {
        const ctx = this.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 350);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.7, '#E0F6FF');
        gradient.addColorStop(1, '#B0E0E6');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, this.canvas.width, 350);
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.drawCloud(100, 60, 40);
        this.drawCloud(350, 100, 50);
        this.drawCloud(450, 50, 35);
    }
    
    drawCloud(x, y, size) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y - size * 0.2, size * 0.4, 0, Math.PI * 2);
        ctx.arc(x + size * 0.8, y, size * 0.45, 0, Math.PI * 2);
        ctx.arc(x + size * 0.4, y + size * 0.2, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawGround() {
        const ctx = this.ctx;
        const gradient = ctx.createLinearGradient(0, 350, 0, 400);
        gradient.addColorStop(0, '#90EE90');
        gradient.addColorStop(1, '#228B22');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 350, this.canvas.width, 50);
        
        ctx.strokeStyle = '#2E8B57';
        ctx.lineWidth = 1;
        for (let i = 0; i < 50; i++) {
            const x = i * 10 + Math.random() * 5;
            ctx.beginPath();
            ctx.moveTo(x, 355);
            ctx.lineTo(x + 2, 348 + Math.random() * 5);
            ctx.stroke();
        }
    }
    
    async saveDesign() {
        const name = document.getElementById('designName').value.trim();
        if (!name) {
            alert('请输入设计名称!');
            return;
        }
        
        const design = {
            name: name,
            sweepAngle: this.params.sweepAngle,
            wingSpan: this.params.wingSpan,
            centerOfGravity: this.params.centerOfGravity,
            paperFold: this.params.paperFold,
            paperWeight: this.params.paperWeight,
            liftToDragRatio: this.results.liftToDragRatio,
            stability: this.results.stability,
            bestDistance: this.results.distance
        };
        
        try {
            const response = await fetch('/api/designs', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(design)
            });
            
            const result = await response.json();
            this.currentDesignId = result.id;
            alert('设计保存成功! 点击分享按钮可以分享给好友。');
            this.loadLeaderboard();
        } catch (error) {
            console.error('保存失败:', error);
            alert('保存失败，请重试');
        }
    }
    
    openShareModal() {
        if (!this.currentDesignId) {
            alert('请先保存设计后再分享!');
            return;
        }
        
        const shareUrl = `${window.location.origin}${window.location.pathname}?share=${this.currentDesignId}`;
        document.getElementById('shareLink').value = shareUrl;
        document.getElementById('shareModal').style.display = 'block';
    }
    
    async loadSharedDesign(shareId) {
        try {
            const response = await fetch(`/api/designs/share/${shareId}`);
            if (!response.ok) {
                return;
            }
            
            const design = await response.json();
            
            document.getElementById('designName').value = design.name;
            this.params.sweepAngle = design.sweepAngle;
            this.params.wingSpan = design.wingSpan;
            this.params.centerOfGravity = design.centerOfGravity;
            this.params.paperFold = design.paperFold;
            this.params.paperWeight = design.paperWeight;
            
            document.getElementById('sweepAngle').value = design.sweepAngle;
            document.getElementById('sweepAngleValue').textContent = design.sweepAngle;
            document.getElementById('wingSpan').value = design.wingSpan;
            document.getElementById('wingSpanValue').textContent = design.wingSpan;
            document.getElementById('centerOfGravity').value = design.centerOfGravity;
            document.getElementById('centerOfGravityValue').textContent = design.centerOfGravity;
            
            document.querySelectorAll('.fold-btn').forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.fold === design.paperFold) {
                    btn.classList.add('active');
                }
            });
            
            document.querySelectorAll('.paper-btn').forEach(btn => {
                btn.classList.remove('active');
                if (parseInt(btn.dataset.weight) === design.paperWeight) {
                    btn.classList.add('active');
                }
            });
            
            this.currentDesignId = design.id;
            this.drawPlane();
            
            alert(`已加载分享的设计: ${design.name}`);
        } catch (error) {
            console.error('加载分享设计失败:', error);
        }
    }
    
    async loadLeaderboard() {
        try {
            const response = await fetch('/api/designs');
            const designs = await response.json();
            
            const leaderboardEl = document.getElementById('leaderboard');
            
            if (designs.length === 0) {
                leaderboardEl.innerHTML = '<div class="no-data">还没有记录，快来创造第一个!</div>';
                return;
            }
            
            let html = '';
            designs.forEach((design, index) => {
                const rankClass = index < 3 ? `rank-${index + 1}` : 'rank-other';
                const foldName = this.foldTemplates[design.paperFold]?.name || design.paperFold;
                html += `
                    <div class="leaderboard-item">
                        <div class="rank ${rankClass}">${index + 1}</div>
                        <div class="info">
                            <div class="name">${design.name}</div>
                            <div class="params">
                                ${foldName} | ${design.paperWeight}g | 后掠角: ${design.sweepAngle}°
                            </div>
                        </div>
                        <div class="distance">${design.bestDistance}m</div>
                    </div>
                `;
            });
            
            leaderboardEl.innerHTML = html;
        } catch (error) {
            console.error('加载排行榜失败:', error);
            document.getElementById('leaderboard').innerHTML = 
                '<div class="no-data">加载失败</div>';
        }
    }
    
    async createCompetition() {
        const name = document.getElementById('competitionName').value.trim();
        if (!name) {
            alert('请输入比赛名称!');
            return;
        }
        
        const competition = {
            name: name,
            description: '纸飞机设计大赛',
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            maxWeight: 120,
            minWeight: 60
        };
        
        try {
            const response = await fetch('/api/competitions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(competition)
            });
            
            const result = await response.json();
            alert('比赛创建成功!');
            this.loadCompetitions();
            document.getElementById('competitionName').value = '';
        } catch (error) {
            console.error('创建比赛失败:', error);
            alert('创建比赛失败，请重试');
        }
    }
    
    async loadCompetitions() {
        try {
            const response = await fetch('/api/competitions');
            const competitions = await response.json();
            
            const listEl = document.getElementById('competitionList');
            
            if (competitions.length === 0) {
                listEl.innerHTML = '<div class="no-data">还没有比赛，创建第一个吧!</div>';
                return;
            }
            
            let html = '';
            competitions.forEach(comp => {
                const startDate = new Date(comp.startDate).toLocaleDateString();
                html += `
                    <div class="competition-item" data-id="${comp.id}" data-name="${comp.name}">
                        <h5>🏆 ${comp.name}</h5>
                        <div class="meta">开始: ${startDate} | 纸张: ${comp.minWeight}g - ${comp.maxWeight}g</div>
                    </div>
                `;
            });
            
            listEl.innerHTML = html;
            
            document.querySelectorAll('.competition-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.currentCompetitionId = item.dataset.id;
                    document.getElementById('currentCompetitionName').textContent = item.dataset.name;
                    document.getElementById('competitionList').style.display = 'none';
                    document.getElementById('competitionDetail').style.display = 'block';
                    this.loadCompetitionLeaderboard(this.currentCompetitionId);
                });
            });
        } catch (error) {
            console.error('加载比赛失败:', error);
        }
    }
    
    backToCompetitionList() {
        document.getElementById('competitionList').style.display = 'block';
        document.getElementById('competitionDetail').style.display = 'none';
        this.currentCompetitionId = null;
    }
    
    async loadCompetitionLeaderboard(competitionId, showLoading = false) {
        const leaderboardEl = document.getElementById('competitionLeaderboard');
        
        if (showLoading) {
            leaderboardEl.innerHTML = '<div class="loading">刷新排名中...</div>';
        }
        
        try {
            const response = await fetch(`/api/competitions/${competitionId}/leaderboard`, {
                cache: 'no-cache',
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            const entries = await response.json();
            
            if (entries.length === 0) {
                leaderboardEl.innerHTML = '<div class="no-data">还没有参赛记录，快来参加!</div>';
                return;
            }
            
            let html = '';
            entries.forEach((entry, index) => {
                const rankClass = index < 3 ? `rank-${index + 1}` : 'rank-other';
                const foldName = this.foldTemplates[entry.paperFold]?.name || entry.paperFold;
                html += `
                    <div class="leaderboard-item">
                        <div class="rank ${rankClass}">${index + 1}</div>
                        <div class="info">
                            <div class="name">${entry.playerName}</div>
                            <div class="params">
                                ${entry.designName} | ${foldName}
                            </div>
                        </div>
                        <div class="distance">${entry.distance}m</div>
                    </div>
                `;
            });
            
            leaderboardEl.innerHTML = html;
        } catch (error) {
            console.error('加载比赛排行榜失败:', error);
            leaderboardEl.innerHTML = '<div class="no-data">加载失败</div>';
        }
    }
    
    openCompetitionModal() {
        if (!this.currentCompetitionId) {
            alert('请先选择一个比赛!');
            return;
        }
        if (!this.currentDesignId) {
            alert('请先保存设计后再参加比赛!');
            return;
        }
        if (!this.results.distance) {
            alert('请先试飞获取飞行距离!');
            return;
        }
        
        document.getElementById('currentDistance').textContent = this.results.distance;
        document.getElementById('competitionModal').style.display = 'block';
    }
    
    async joinCompetition() {
        const playerName = document.getElementById('playerName').value.trim();
        if (!playerName) {
            alert('请输入玩家昵称!');
            return;
        }
        
        const entry = {
            designId: this.currentDesignId,
            playerName: playerName,
            distance: this.results.distance
        };
        
        try {
            const response = await fetch(`/api/competitions/${this.currentCompetitionId}/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entry)
            });
            
            const result = await response.json();
            document.getElementById('competitionModal').style.display = 'none';
            document.getElementById('playerName').value = '';
            
            await this.loadCompetitionLeaderboard(this.currentCompetitionId, true);
            
            const entries = document.querySelectorAll('#competitionLeaderboard .leaderboard-item');
            let rank = -1;
            entries.forEach((item, idx) => {
                const nameEl = item.querySelector('.name');
                if (nameEl && nameEl.textContent === playerName) {
                    rank = idx + 1;
                }
            });
            
            if (rank > 0) {
                alert(`🎉 参赛成功! 当前排名: 第 ${rank} 名\n飞行距离: ${this.results.distance}m`);
            } else {
                alert('参赛成功! 祝你取得好成绩!');
            }
        } catch (error) {
            console.error('参赛失败:', error);
            alert('参赛失败，请重试');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PaperPlaneGame();
});
