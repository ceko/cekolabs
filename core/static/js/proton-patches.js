;Proton.WebGLRender.prototype.updateMatrix = function(particle) {	
	var moveOriginMatrix = Proton.WebGLUtil.makeTranslation(-particle.transform.textureWidth / 2, -particle.transform.textureHeight / 2);
    var translationMatrix = Proton.WebGLUtil.makeTranslation(particle.p.x, particle.p.y);
    var angel = (180-particle.rotation) * (Math.PI / 180);
    var rotationMatrix = Proton.WebGLUtil.makeRotation(angel);
    var scale = particle.scale * particle.transform.oldScale;
    var scaleMatrix = Proton.WebGLUtil.makeScale(scale, scale);

    var matrix = Proton.WebGLUtil.matrixMultiply(moveOriginMatrix, scaleMatrix);
    matrix = Proton.WebGLUtil.matrixMultiply(matrix, rotationMatrix);
    matrix = Proton.WebGLUtil.matrixMultiply(matrix, translationMatrix);

    Proton.Mat3.inverse(matrix, particle.transform.imat);
    matrix[2] = particle.alpha;
    this.mstack.push(matrix);
};
