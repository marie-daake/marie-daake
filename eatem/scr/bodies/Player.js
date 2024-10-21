var Player = function(game, properties) {


	this.player = game.add.sprite(properties.x, properties.y, 'playerSpritesheet');
	this.player.anchor.setTo(0.5, 0.5);
	this.player.scale.setTo(1, 1);

	game.physics.enable(this.player, Phaser.Physics.ARCADE);
	this.player.body.collideWorldBounds = true;
	this.player.body.allowGravity = true;
	// Setting the max velocity in y to avoid being able to fall through
	// the world
	this.player.body.maxVelocity.y = 995;

	this.player.originalSpeed = properties.playerSpeed;
	this.player.playerSpeed = properties.playerSpeed;
	this.player.jumpHeight = properties.jumpHeight;
	this.player.abilityOne = null;
	this.player.abilityTwo = null;
	this.player.amountOfAbilities = 2;
	this.player.newAbility = '';
	this.player.onAbility = false;

	this.player.abilityCooldown = 0;
	this.player.swapCooldown = 0;
	this.player.coolDownTime = 1000;
	this.player.moveLock = false;
	this.player.isStomping = false;
	this.player.alive = true;

	// Loading animations for player
	this.player.animations.add('stop', [0]);
	this.player.animations.add('walk', [0, 1]);
	this.player.animations.add('jump', [2]);
	this.player.animations.add('die', [3]);


	// Loading audio specific for player
	jumpAudio = game.add.audio('jumpAudio');
	roofHitAudio = game.add.audio('roofHitAudio');
	highJumpAudio = game.add.audio('highJumpAudio');
	longJumpAudio = game.add.audio('longJumpAudio');
	stompEndAudio = game.add.audio('stompEndAudio');
	powerUpAudio = game.add.audio('powerUpAudio');
	shootAudio = game.add.audio('shootAudio');

	/**
	 * Gives the player a velocity in the direction sent in or if stop
	 * reduces the velocity
	 */
	this.player.move = function(direction) {

		player.setAnimation();

		if (direction == "stop") {

			// Gradually slows the player down to 0 speed. 
			if (player.body.velocity.x > 0)
				player.body.velocity.x -= player.playerSpeed / 10;

			else if (player.body.velocity.x < 0)
				player.body.velocity.x += player.playerSpeed / 10;
			
			if (Math.abs(player.body.velocity.x) <= player.playerSpeed * 0.05)
				player.body.velocity.x = 0; 
			
			if (player.body.onFloor() || player.body.touching.down) {
				player.setMoveLock(false);
				player.stopStomping();
				player.playerSpeed = player.originalSpeed;
			}
		}

		if (!player.hasMoveLock()) {
			if (direction == "right") {
				player.scale.setTo(Math.abs(player.scale.x), player.scale.y);
				player.body.velocity.x = player.playerSpeed;
			}
			else if (direction == "left") {
				player.scale.setTo(-Math.abs(player.scale.x), player.scale.y);
				player.body.velocity.x = -player.playerSpeed;
			}
			else if (direction == "jump") {
				if (player.body.onFloor() ||
					(touchingBreakableBlock(player, 'over', breakableGroup) && player.body.touching.down)) {
					
					if (!player.body.touching.up)
						jumpAudio.play();

					// this prevents the super jump by pressing up + highJump.
					if (!(controls.abilityOne.isDown || controls.abilityTwo.isDown))
						player.body.velocity.y = -player.jumpHeight;
				}
			}
		}
	};

	/**
	 * Used to set the animation of the player based on whether it is 
	 * in the air, on the ground or jumping
	 */
	this.player.setAnimation = function() {
		if (!(player.body.onFloor() || touchingBreakableBlock(player, 'over', breakableGroup))) {
			player.animations.play('jump', 1, true);
		}
		else if (Math.abs(player.body.velocity.x) > 5) {
			player.animations.play('walk', 7, true);
		}
		else {
			player.animations.play('stop', 1, true);
		}
	};

	/**
	 * Calls the ability responding to the number sent in
	 */
	this.player.callAbility = function(game, key) {

		var ability;

		if (player.canSwap()) {
			player.swapAbility(key);
		}

		else if (key == 1) {
			ability = player.abilityOne;
		}
		else if (key == 2) {
			ability = player.abilityTwo;
		}

		switch (ability) {
			case 'highJump':
				player.highJump();
				break;
			case 'longJump':
				player.longJump();
				break;
			case 'stomp':
				player.stomp();
				break;
			case 'shoot':
				player.shoot(game);
				break;
			default:
		}

	};

	/**
	 * Gives him an extrodinary jump height, however, his superb ninja skills 
	 * makes him still being able to move in x-direciton whilst in the air.
	 */
	this.player.highJump = function() {
		if (!player.hasCoolDown() && (player.body.onFloor() || touchingBreakableBlock(player, 'over', breakableGroup))) {

			highJumpAudio.play();
			player.body.velocity.y -= player.jumpHeight * 1.9;
			player.playerSpeed /= 2;
			player.setCoolDown();
		}

	};

	/**
	 * While not giving the player the extrordinary jump heigh as in highJump,
	 * this function does give the player a small boost in the velocity of y
	 * and a great velocity in the world of x:es. This does however also lock
	 * the player making him not able to change direction when the jump has been
	 * initiated.
	 */
	this.player.longJump = function() {
		if (!player.hasCoolDown()) {

			var longJumpSpeed = player.originalSpeed;

			if (player.playerSpeed != player.originalSpeed)
				longJumpSpeed = player.originalSpeed * 0.75;

			longJumpAudio.play();

			player.body.velocity.y = -player.jumpHeight * 0.8;
			player.body.velocity.x = player.direction() * longJumpSpeed * 3;

			// Gradually increase the x-velocity in order to avoid falling through tile layers (inherent Phaser problem)
			for (var i = 1; i < 5; i++)
				game.time.events.add(Phaser.Timer.SECOND * i * 0.1, function() {
					player.body.velocity.x += player.direction() * longJumpSpeed / 2;
				})

			player.setCoolDown(1.5);
			player.setMoveLock(true);
		}
	};

	/**
	 * To overcome, or rather, undercome, the obstacles in the map the player 
	 * needs to be able to angrily destroy them by stomping on them. This ability
	 * gives the player just that ability. By throwing himself up in the air
	 * he can then stomp really hard on the ground destroying breakable obstacles
	 * beneth the player's feet ... or you know, I don't know if cricket have feet. 
	 * But whatever they have.
	 */
	this.player.stomp = function() {
		if (!player.hasCoolDown() && !player.isStomping) {
			player.body.velocity.y = -player.jumpHeight * 1.2;

			game.time.events.add(Phaser.Timer.SECOND * 0.4, function() {
				if (player.body.velocity.y < 0) {
					player.isStomping = true;

					player.body.velocity.y = player.body.maxVelocity.y;
				}

			});

			player.setCoolDown();
			player.setMoveLock(true);
		}
	};

	/**
	 * When the cricket finally succumbs to his inner peace this function makes
	 * him stop stomping. However, someone does need to call the function first.
	 */
	this.player.stopStomping = function() {
		if (player.isStomping) {
			stompEndAudio.play();
			game.camera.shake(0.03, 150, false, Phaser.Camera.SHAKE_BOTH);
		}
		player.isStomping = false;
	};

	/**
	 * A cricket always needs to know of his surroundings. With the help of this 
	 * function he can check so he does not hit his tiny .. or rather large head.
	 */
	this.player.checkRoofCollision = function(game) {
		if (player.body.blocked.up || touchingBreakableBlock(player, 'under', breakableGroup)) {

			roofHitAudio.play();

			player.hurt(0.02, 150);
		}
	};

	/**
	 * Not many knows that the cricket has the ability to call on lethal 
	 * projectiles launched out of his body.
	 */
	this.player.shoot = function(game) {
		if (!player.hasCoolDown()) {
			shootAudio.play();
			shoot(game, player, projectiles);
			player.setCoolDown();
		}
	};

	/**
	 * Returns the X-direction of the player
	 */
	this.player.direction = function() {
		return (player.scale.x / Math.abs(player.scale.x));
	};

	/**
	 * Returns true if the player has a coolDown on the abilites,
	 * otherwise false
	 */
	this.player.hasCoolDown = function() {
		return !(game.time.now > player.abilityCooldown);
	};

	/**
	 * Returns true if the player is not allowed to move, otherwise false
	 */
	this.player.hasMoveLock = function() {
		return player.moveLock;
	};

	/**
	 * Returns true if the player is standing on another ability making
	 * the player elgible to swap abilites
	 */
	this.player.hasAbilitySwap = function() {
		return game.physics.arcade.overlap(player, player.newAbility);
	};

	/**
	 * Returns true if the player has a free ability slot, otherwise false
	 */
	this.player.hasFreeAbilitySlot = function() {
		if (player.abilityOne == null)
			return true;
		else if (player.abilityTwo == null && player.amountOfAbilities == 2)
			return true;
		else
			return false;
	};

	/**
	 * Returns true if the player has a side blocked, otherwise false
	 * Note however that this only works if the player is constantly moving
	 * towards that object, not if only standing next to it.
	 */
	this.player.hasSideBlocked = function() {
		if (player.body.blocked.left || player.body.blocked.right)
			return true;
		else
			return false;
	};

	/**
	 * Returns 0 if no empty slot 
	 */
	this.player.getFirstEmptyAbility = function() {
		if (player.abilityOne == null)
			return 1;
		else if (player.abilityTwo == null && player.amountOfAbilities == 2)
			return 2;
		else
			return 0;
	}

	/**
	 * Sets the cooldown for abilities of the player
	 * factor: default = 1, 2 gives double the cooldown, 0.5 half etc.
	 */
	this.player.setCoolDown = function(factor = 1) {
		player.abilityCooldown = game.time.now + player.coolDownTime * factor;
		displayAbilityCooldown(game, player.coolDownTime * factor, player.abilityTwo != null);
	};

	/**
	 * Sets the moveLock of the player to the bool sent in
	 */
	this.player.setMoveLock = function(bool) {
		player.moveLock = bool;
	};

	/**
	 * Reads an ability and creates a reference to it.
	 * This is used for when moving over an item on the ground. When pressed the player
	 * wants to swap this will be the item that it swaps to.
	 */
	this.player.fillAbilitySlot = function(ability) {
		player.newAbility = ability;
		if (player.hasFreeAbilitySlot() && player.newAbility.name != player.abilityOne)
			player.swapAbility(player.getFirstEmptyAbility());
	};


	/**
	 * Swaps one ability that the player currently has to the object it has read
	 * in in fillAbilitySlot. The ability swapped is decided by the key sent into 
	 * this function.
	 */
	this.player.swapAbility = function(key) {

		powerUpAudio.play();
		if (!player.hasFreeAbilitySlot())
			player.setCoolDown(0.5);
		var tempAbility;
		if (key == 1) {
			tempAbility = player.abilityOne;
			player.abilityOne = player.newAbility.name;
		}
		else if (key == 2) {
			tempAbility = player.abilityTwo;
			player.abilityTwo = player.newAbility.name;
		}


		//Updating the buttons shown on screen through the callback function
		updateAbilityTexture(key, player.newAbility.name);


		if (tempAbility == null) {
			player.newAbility.kill();
		}
		else {
			player.newAbility.loadTexture(tempAbility);
			player.newAbility.name = tempAbility;
			player.newAbility.key = tempAbility;
		}

		player.swapCooldown = game.time.now + player.coolDownTime * 0.5;

	};

	/**
	 * Returns true if the player has a bility to swap with as well as does not 
	 * have a cooldown for abilities.
	 */
	this.player.canSwap = function() {

		if ((game.time.now > player.swapCooldown) && (player.hasAbilitySwap())) {
			if (!(player.abilityOne == player.newAbility.name || player.abilityTwo == player.newAbility.name)) {
				return (player.body.onFloor());
			}
		}
		return false;
	};

	/**
	 * Makes the camera shake and the player to blink.
	 * intensity: intensity of camera shake
	 * duration: duration of the shake
	 */
	this.player.hurt = function(intensity, duration) {

		game.camera.shake(intensity, duration, false, Phaser.Camera.SHAKE_BOTH);
		for (var temp = 0; temp < 4; temp++) {
			game.time.events.add(Phaser.Timer.SECOND * 0.1 * temp, function() {
				if (player.alpha == 1)
					player.alpha = 0.2;
				else
					player.alpha = 1;

			}, this);
		}
	}

	/**
	 * Plays the death animation for the player and kills it
	 */
	this.player.death = function() {

		player.animations.play('die', 1, true);
		killBody(player);
		player.isStomping = false;

	};

	/**
	 * Spawns the player at the spawn point
	 */
	this.player.spawn = function() {

		spawnGroup.forEach(function(spawnPoint) {

			player.reset(spawnPoint.x, spawnPoint.y);

		}, this);

	};

	return this.player;

}
