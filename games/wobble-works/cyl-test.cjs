const CANNON = require('./vendor/cannon.min.js');

function makeWorld() {
  const world = new CANNON.World();
  world.gravity.set(0, -22, 0);
  world.solver.iterations = 10;
  world.defaultContactMaterial.friction = 0.3;
  const ground = new CANNON.Body({ mass: 0 });
  ground.addShape(new CANNON.Plane());
  ground.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(ground);
  return world;
}

// TEST 1: simple sphere onto plaza cylinder
{
  const world = makeWorld();
  const plaza = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, 0.25, 0) });
  plaza.addShape(new CANNON.Cylinder(7.5, 8, 0.5, 12));
  world.addBody(plaza);
  const ball = new CANNON.Body({ mass: 12, position: new CANNON.Vec3(0, 3, 0) });
  ball.addShape(new CANNON.Sphere(0.85));
  world.addBody(ball);
  for (let i = 0; i < 120; i++) world.step(1/60);
  console.log('TEST 1 simple sphere on plaza: y =', ball.position.y.toFixed(2), '(1.35 = ON stage | 0.85 = fell through)');
}

// TEST 2: compound 2-sphere player onto plaza cylinder
{
  const world = makeWorld();
  const plaza = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, 0.25, 0) });
  plaza.addShape(new CANNON.Cylinder(7.5, 8, 0.5, 12));
  world.addBody(plaza);
  const p = new CANNON.Body({ mass: 16, fixedRotation: true, position: new CANNON.Vec3(0, 1.2, 0) });
  p.addShape(new CANNON.Sphere(0.6), new CANNON.Vec3(0, 0.6, 0));
  p.addShape(new CANNON.Sphere(0.55), new CANNON.Vec3(0, 1.35, 0));
  world.addBody(p);
  for (let i = 0; i < 120; i++) world.step(1/60);
  console.log('TEST 2 compound player on plaza: y =', p.position.y.toFixed(2), '(0.5 = ON stage | 0.0 = fell through)');
}

// TEST 3: compound player onto BOX platform (the fix candidate)
{
  const world = makeWorld();
  const plaza = new CANNON.Body({ mass: 0, position: new CANNON.Vec3(0, 0.25, 0) });
  plaza.addShape(new CANNON.Box(new CANNON.Vec3(7, 0.25, 7)));
  world.addBody(plaza);
  const p = new CANNON.Body({ mass: 16, fixedRotation: true, position: new CANNON.Vec3(0, 1.2, 0) });
  p.addShape(new CANNON.Sphere(0.6), new CANNON.Vec3(0, 0.6, 0));
  p.addShape(new CANNON.Sphere(0.55), new CANNON.Vec3(0, 1.35, 0));
  world.addBody(p);
  for (let i = 0; i < 120; i++) world.step(1/60);
  console.log('TEST 3 compound player on BOX plaza: y =', p.position.y.toFixed(2), '(0.5 = ON stage | 0.0 = fell through)');
}