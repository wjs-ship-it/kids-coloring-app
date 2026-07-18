export function createDemoCatBlob() {
  return new Promise(resolve => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 400;
    const g = c.getContext('2d');
    g.fillStyle = '#87CEEB'; g.fillRect(0, 0, 400, 400);
    g.fillStyle = '#FFA500';
    g.beginPath(); g.ellipse(200, 260, 120, 140, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(200, 150, 90, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(130, 80); g.lineTo(110, 20); g.lineTo(160, 60); g.fill();
    g.beginPath(); g.moveTo(270, 80); g.lineTo(290, 20); g.lineTo(240, 60); g.fill();
    g.fillStyle = '#fff';
    g.beginPath(); g.arc(170, 140, 20, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(230, 140, 20, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#333';
    g.beginPath(); g.arc(175, 142, 10, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(235, 142, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FF69B4';
    g.beginPath(); g.moveTo(200, 165); g.lineTo(193, 175); g.lineTo(207, 175); g.fill();
    g.strokeStyle = '#333'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(200, 175); g.lineTo(200, 185);
    g.moveTo(200, 185); g.quadraticCurveTo(185, 195, 175, 185);
    g.moveTo(200, 185); g.quadraticCurveTo(215, 195, 225, 185); g.stroke();
    g.beginPath(); g.moveTo(120, 160); g.lineTo(165, 170);
    g.moveTo(120, 180); g.lineTo(165, 178);
    g.moveTo(235, 170); g.lineTo(280, 160);
    g.moveTo(235, 178); g.lineTo(280, 180); g.stroke();
    c.toBlob(blob => resolve(blob), 'image/png');
  });
}
