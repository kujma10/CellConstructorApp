import React from 'react';
import ReactDOM from 'react-dom';
import AppWrapper from './components/AppWrapper.js';
import {Provider} from 'react-redux';
import {createStore} from 'redux';
import reactionsReducer from './reducers';
import Render from './matterjs/CustomRender.js'

let store = createStore(
  reactionsReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__()
);

ReactDOM.render(
  <Provider store={store}>
    <AppWrapper />
  </Provider>,
  document.getElementById('ui')
);

let Matter = require('matter-js/build/matter.js');

// module aliases
let Engine = Matter.Engine,
  World = Matter.World,
  Bodies = Matter.Bodies,
  Composites = Matter.Composites,
  Common = Matter.Common,
  Constraint = Matter.Constraint,
  Body = Matter.Body,
  Events = Matter.Events,
  Mouse = Matter.Mouse,
  MouseConstraint = Matter.MouseConstraint;

// create an engine
let engine = Engine.create();

// create a renderer
let render = Render.create({
  element: document.getElementById('canvas'),
  engine: engine,
  options: {
    background: '#fafafa',
    width: Math.min(document.documentElement.clientWidth, 600),
    height: Math.min(document.documentElement.clientHeight, 600),
    bodyNames: true
  },
});

render.options.wireframes = false;

engine.world.gravity.scale = 0;

function createAtom(x, y, type, color) {
  let atom = Bodies.circle(x, y, Common.random(14, 20), {
    restitution: 1,
    friction: 0,
    frictionAir: 0,
    frictionStatic: 0,
    inertia: Infinity,
    atomType: type,
    atomState: 0,
    render: {
      strokeStyle: color,
      fillStyle: color,
    },
  });

  Body.setVelocity(atom, {
    x: Common.random(-5, 5),
    y: Common.random(-5, 5),
  });

  return atom;
};

let atomsA = Composites.stack(100, 50, 1, 10, 10, 10, function(x, y) {
  return createAtom(x, y, 'A', '#cc3838');
});

let atomsB = Composites.stack(200, 50, 1, 10, 10, 10, function(x, y) {
  return createAtom(x, y, 'B', '#911a25');
});

let atomsC = Composites.stack(300, 50, 1, 10, 10, 10, function(x, y) {
  return createAtom(x, y, 'C', '#222f3d');
});

let atomsD = Composites.stack(400, 50, 1, 10, 10, 10, function(x, y) {
  return createAtom(x, y, 'D', '#94c131');
});

let atomsE = Composites.stack(500, 50, 1, 10, 10, 10, function(x, y) {
  return createAtom(x, y, 'E', '#1b9a91');
});

let bottom = Bodies.rectangle(300, 600, 600, 1, {isStatic: true});
let left = Bodies.rectangle(0, 300, 1, 600, {isStatic: true});
let top = Bodies.rectangle(300, 0, 600, 1, {isStatic: true});
let right = Bodies.rectangle(600, 300, 1, 600, {isStatic: true});

World.add(engine.world, [atomsA, atomsB, atomsC, atomsD, atomsE, top, bottom, left, right]);

// add mouse control
let mouse = Mouse.create(render.canvas),
  mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.002,
      render: {
        visible: true,
      },
    },
  });
World.add(engine.world, mouseConstraint);

// keep the mouse in sync with rendering
render.mouse = mouse;
let momentums = {};

function calculateSpeed(velocity){
  return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
}

function matchAtoms(firstBody, firstReactant, secondBody, secondReactant) {
  const equalsType = firstBody.atomType == firstReactant.type && secondBody.atomType == secondReactant.type;
  const equalsState = firstBody.atomState == firstReactant.state && secondBody.atomState == secondReactant.state;
  if(equalsType && equalsState) return true;
  return false;
}

Events.on(engine, 'collisionStart', function(event) {
  const reactionList = store.getState().reactionList;
  let pairs = event.pairs;

  for (let i = 0, j = pairs.length; i != j; ++i) {
    let pair = pairs[i];

    if(pair.bodyA.label == "Circle Body" && pair.bodyB.label == "Circle Body"){
      const totalMomentrumBeforeCollision = pair.bodyA.mass * calculateSpeed(pair.bodyA.velocity) + pair.bodyB.mass * calculateSpeed(pair.bodyB.velocity);
      // Sometimes body.speed not equals to ((body.velocity.x)^2 + (body.velocity.y)^2)^0.5, why?
      //const totalMomentrumBeforeCollision = pair.bodyA.mass * pair.bodyA.speed + pair.bodyB.mass * pair.bodyB.speed;
      momentums[pair.id] = totalMomentrumBeforeCollision;
    }


    reactionList.filter((reaction) => !reaction.bondedBefore).forEach(function(currentReaction){
      const cond1 = matchAtoms(pair.bodyA, currentReaction.firstReactant, pair.bodyB, currentReaction.secondReactant);
      const cond2 = matchAtoms(pair.bodyA, currentReaction.secondReactant, pair.bodyB, currentReaction.firstReactant);

      if(currentReaction.bondedAfter &&  (cond1 || cond2)) {
        let constraint = Constraint.create({
          bodyA: pair.bodyA,
          bodyB: pair.bodyB,
          length: pair.bodyA.circleRadius + pair.bodyB.circleRadius - 1,
          stiffness: 0,
        });

        pair.bodyA.atomState = cond1 ? currentReaction.firstProduct.state : currentReaction.secondProduct.state;
        pair.bodyB.atomState = cond1 ? currentReaction.secondProduct.state : currentReaction.firstProduct.state;
        World.addConstraint(engine.world, constraint);
      }

      pair.bodyA.atomState = cond1 ? currentReaction.firstProduct.state : cond2 ? currentReaction.secondProduct.state : pair.bodyA.atomState;
      pair.bodyB.atomState = cond1 ? currentReaction.secondProduct.state : cond2 ? currentReaction.firstProduct.state : pair.bodyB.atomState;
    });
  }
});

// `collisionActive` seems better than `collisionEnd`, why?
Events.on(engine, 'collisionActive', function(event) {
  var pairs = event.pairs;

  for (var i = 0, j = pairs.length; i != j; ++i) {
    var pair = pairs[i];


    const momentumBeforeCollision = momentums[pair.id];
    if(momentumBeforeCollision){
      const momentumAfterCollision = pair.bodyA.mass * calculateSpeed(pair.bodyA.velocity) + pair.bodyB.mass * calculateSpeed(pair.bodyB.velocity);
      //const momentumAfterCollision = pair.bodyA.mass * pair.bodyA.speed + pair.bodyB.mass * pair.bodyB.speed;

      // sometimes it's less than 1, why?
      const diff = momentumBeforeCollision / momentumAfterCollision;

      Body.setVelocity(pair.bodyA, {
        x: pair.bodyA.velocity.x * diff,
        y: pair.bodyA.velocity.y * diff,
      });

      Body.setVelocity(pair.bodyB, {
        x: pair.bodyB.velocity.x * diff,
        y: pair.bodyB.velocity.y * diff,
      });

      const momentumAfterCollision2 = pair.bodyA.mass * calculateSpeed(pair.bodyA.velocity) + pair.bodyB.mass * calculateSpeed(pair.bodyB.velocity);
      //const momentumAfterCollision2 = pair.bodyA.mass * pair.bodyA.speed + pair.bodyB.mass * pair.bodyB.speed;

      let diff2 = momentumBeforeCollision - momentumAfterCollision2;
      // these are logged when momentums are calculated using `body.speed`
      if(diff2 > 0.001 || diff2 < -0.001){
        console.log("Difference between momentums")
      }

    }
  }

});

document.getElementById("submit").addEventListener("click", function(){
  const currentReaction = store.getState().currentReaction;
  if(currentReaction.bondedBefore){
    const constraints = Matter.Composite.allConstraints(engine.world)
    constraints.forEach(function(constraint){
      if(constraint.bodyA && constraint.bodyB && constraint.label == 'Constraint'){
        const cond1 = matchAtoms(constraint.bodyA, currentReaction.firstReactant, constraint.bodyB, currentReaction.secondReactant);
        const cond2 = matchAtoms(constraint.bodyA, currentReaction.secondReactant, constraint.bodyB, currentReaction.firstReactant);
        if(cond1 || cond2){
          if(!currentReaction.bondedAfter){
            Matter.Composite.remove(engine.world, constraint);
          }
          constraint.bodyA.atomState = cond1 ? currentReaction.firstProduct.state : cond2 ? currentReaction.secondProduct.state : constraint.bodyA.atomState;
          constraint.bodyB.atomState = cond1 ? currentReaction.secondProduct.state : cond2 ? currentReaction.firstProduct.state : constraint.bodyB.atomState;
        }
      }
    })
  }
});

// run the engine
Engine.run(engine);

// run the renderer
Render.run(render);
