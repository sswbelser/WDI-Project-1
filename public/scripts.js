$(function() {

	var commentController = {

		// compile comment template
		template: _.template($('#comment-template').html()),

		all: function() {
			$.get('/api/comments', function(data) {
				var allComments = data;
				// iterate through allComments
				_.each(allComments, function(comment) {
					// pass each comment object through template and append to view
					var $commentHtml = $(commentController.template(comment));
					$('#comment-list').prepend($commentHtml);
				});
				// add event-handlers to comments for updating/deleting
				commentController.addEventHandlers();
			});
		},

		create: function(newComment) {
			var commentData = {comment: newComment};
			// send COMMENT request to server to create new comment
			$.post('/api/comments', commentData, function(data) {
				// pass post object through template and prepend to view
				var $commentHtml = $(commentController.template(data));
				$('#comment-list').prepend($commentHtml);
			});
		},

		update: function(commentId, updatedComment) {
			// send PUT request to server to update comment
			$.ajax({
				type: 'PUT',
				url: '/api/comments/' + commentId,
				data: {
					comment: updatedComment
				},
				success: function(data) {
					// pass comment object through template and append to view
					var $commentHtml = $(commentController.template(data));
					$('#comment-' + commentId).replaceWith($commentHtml);
				}
			});
		},
    
		delete: function(commentId) {
			// send DELETE request to server to delete comment
			$.ajax({
				type: 'DELETE',
				url: '/api/comments/' + commentId,
				success: function(data) {
					// remove deleted comment li from the view
					$('#comment-' + commentId).remove();
				}
			});
		},

		// add event-handlers to comments for updating/deleting
		addEventHandlers: function() {
			$('#comment-list')
			// for update: submit event on `.update-comment` form
			.on('submit', '.update-comment', function(event) {
				event.preventDefault();
				var commentId = $(this).closest('.comment').attr('data-id');
				var updatedComment = $(this).find('.updated-comment').val();
				commentController.update(commentId, updatedComment);
			})
			// for delete: click event on `.delete-comment` button
			.on('click', '.delete-comment', function(event) {
				event.preventDefault();
				var commentId = $(this).closest('.comment').attr('data-id');
				commentController.delete(commentId);
			});
		},

		setupView: function() {
			// append existing posts to view
			commentController.all();
			// add event-handler to new-comment form
			$('#new-comment').on('submit', function(event) {
				event.preventDefault();
				var commentText = $('#comment-text').val();
				commentController.create(commentText);
				// reset the form
				$(this)[0].reset();
			});
		}
	};

	commentController.setupView();

	var scoreController = {

		// compile score template
		template: _.template($('#score-template').html()),

		all: function() {
			$.get('/api/scores', function(data) {
				var allScores = data;
				// iterate through allScores
				_.each(allScores, function(score) {
					// pass each score object through template and append to view
					var $scoreHtml = $(scoreController.template(score));
					$('#leaderboard-list').prepend($scoreHtml);
				});
			});
		},

		create: function(newScore) {
			var scoreData = {score: newScore};
			// send POST request to server to create new score
			$.post('/api/comments', scoreData, function(data) {
				// pass post object through template and prepend to view
				var $scoreHtml = $(scoreController.template(data));
				$('#leaderboard-list').prepend($scoreHtml);
			});
		},



		// Add functionality connecting the create function to the completion of the level
		setupView: function() {
			// append existing to view
			scoreController.all();
		}
	};

	scoreController.setupView();



	// GAME CODE
	var Q = Quintus()
	.include("Sprites, Scenes, Input, 2D, Touch, UI")
	.setup({
		width: 960,
		height: 640,
		development: true
	}).controls().touch();

	//load background tile
	//player
	Q.Sprite.extend("Player", {
		init: function(p) {
			this._super(p, {asset: "player.png", x: 110, y: 50, jumpSpeed: -400, lives: 3, coins: 0});
			this.add("2d, platformerControls"); 
			this.p.timeInvincible = 0;
			this.on("hit.sprite",function(collision) {
				if(collision.obj.isA("Coin")) {
					collision.obj.destroy();
					this.p.coins++;
					var coinsLabel = Q("UI.Text",1).items[1];
					coinsLabel.p.label = 'Coins: '+this.p.coins;
				}
			});
		},
		step: function(dt) {
			if(Q.inputs["left"] && this.p.direction == "right") {
				this.p.flip = "x";
			} 
			if(Q.inputs["right"]  && this.p.direction == "left") {
				this.p.flip = false;                    
			}
			if(this.p.timeInvincible > 0) {
				this.p.timeInvincible = Math.max(this.p.timeInvincible - dt, 0);
			}
		},
		damage: function() {
			//only damage if not in "invincible" mode, otherwise beign next to an enemy takes all the lives inmediatly
			if(!this.p.timeInvincible) {
				this.p.lives--;

				//will be invincible for 1 second
				this.p.timeInvincible = 1;
				if(this.p.lives<0) {
					this.destroy();
					Q.stageScene("endGame",1, { label: "Game Over" }); 
				}
				else {
				//@TODO (yes, to you, who is reading now!) add an animation to show it"s been damaged
				var livesLabel = Q("UI.Text",1).first();
				livesLabel.p.label = "Health: "+this.p.lives;
				}
			}
		}
	});

	//component for common enemy behaviors
	Q.component("commonEnemy", {
		added: function() {
			var entity = this.entity;
			entity.on("bump.left,bump.right,bump.bottom", function(collision) {
				if(collision.obj.isA("Player")) {                        
					collision.obj.damage();
				}
			});
			entity.on("bump.top", function(collision) {
				if(collision.obj.isA("Player")) { 
					//make the player jump
					collision.obj.p.vy = -100;

					//kill enemy
					this.destroy();
				}
			});
		},
	});

	Q.Sprite.extend("GroundEnemy", {
		init: function(p) {
			this._super(p, {vx: -100, defaultDirection: "left"});
			this.add("2d, aiBounce, commonEnemy");
		},
		step: function(dt) {        
			var dirX = this.p.vx/Math.abs(this.p.vx);
			var ground = Q.stage().locate(this.p.x, this.p.y + this.p.h/2 + 1, Q.SPRITE_DEFAULT);
			var nextTile = Q.stage().locate(this.p.x + dirX * this.p.w/2 + dirX, this.p.y + this.p.h/2 + 1, Q.SPRITE_DEFAULT);

			//if we are on ground and there is a cliff
			if(!nextTile && ground) {
				if(this.p.vx > 0) {
					if(this.p.defaultDirection == "right") {
						this.p.flip = "x";
					}
					else {
						this.p.flip = false;
					}
				}
				else {
					if(this.p.defaultDirection == "left") {
						this.p.flip = "x";
					}
					else {
						this.p.flip = false;
					}
				}
				this.p.vx = -this.p.vx;
			}
		}
	});

	Q.Sprite.extend("VerticalEnemy", {
		init: function(p) {
			this._super(p, {vy: -100, rangeY: 200, gravity: 0 });
			this.add("2d, commonEnemy");
			this.p.initialY = this.p.y;
		},
		step: function(dt) {                
			if(this.p.y - this.p.initialY >= this.p.rangeY && this.p.vy > 0) {
				this.p.vy = -this.p.vy;
			}
			else if(-this.p.y + this.p.initialY >= this.p.rangeY && this.p.vy < 0) {
				this.p.vy = -this.p.vy;
			}
		}
	});

	Q.Sprite.extend("Coin", {
		init: function(p) {
			this._super(p, {asset: "coin.png"});
		}
	});

	//setup level 1, @TODO make it so that it could be multiple levels?
	Q.scene("level1",function(stage) {
		var background = new Q.TileLayer({dataAsset: "level1.tmx", layerIndex: 0, sheet: "tiles", tileW: 70, tileH: 70, type: Q.SPRITE_NONE });
		stage.insert(background);
		stage.collisionLayer(new Q.TileLayer({dataAsset: "level1.tmx", layerIndex:1,  sheet: "tiles", tileW: 70, tileH: 70, type: Q.SPRITE_DEFAULT }));
		var player = stage.insert(new Q.Player());

		//level assets. format must be as shown: [[ClassName, params], .. ] 
		var levelAssets = [
			["GroundEnemy", {x: 18*70, y: 6*70, asset: "slime.png"}],
			["VerticalEnemy", {x: 800, y: 120, rangeY: 70, asset: "fly.png"}],
			["VerticalEnemy", {x: 1080, y: 120, rangeY: 80, asset: "fly.png"}],
			["GroundEnemy", {x: 6*70, y: 3*70, asset: "slime.png"}],
			["GroundEnemy", {x: 8*70, y: 70, asset: "slime.png"}],
			["GroundEnemy", {x: 18*70, y: 120, asset: "slime.png"}],
			["GroundEnemy", {x: 12*70, y: 120, asset: "slime.png"}],
			["Coin", {x: 300, y: 100}],
			["Coin", {x: 360, y: 100}],
			["Coin", {x: 420, y: 100}],
			["Coin", {x: 480, y: 100}],
			["Coin", {x: 800, y: 300}],
			["Coin", {x: 860, y: 300}],
			["Coin", {x: 920, y: 300}],
			["Coin", {x: 980, y: 300}],
			["Coin", {x: 1040, y: 300}],
			["Coin", {x: 1100, y: 300}],
			["Coin", {x: 1160, y: 300}],
			["Coin", {x: 1250, y: 400}],
			["Coin", {x: 1310, y: 400}],
			["Coin", {x: 1370, y: 400}]
		];

		//load level assets
		stage.loadAssets(levelAssets);  
		stage.add("viewport").follow(player,{x: true, y: true},{minX: 0, maxX: background.p.w, minY: 0, maxY: background.p.h});
	});

	Q.scene("endGame",function(stage) {
		alert("game over");
		window.location = "";
	});

	Q.scene("gameStats", function(stage) {
		var statsContainer = stage.insert(new Q.UI.Container({
			fill: "gray",
			x: 960/2,
			y: 620,
			border: 1,
			shadow: 3,
			shadowColor: "rgba(0,0,0,0.5)",
			w: 960,
			h: 40
		}));

		var lives = stage.insert(new Q.UI.Text({ 
			label: "Health: 3",
			color: "white",
			x: -300,
			y: 0
		}),statsContainer);

		var timer = stage.insert(new Q.UI.Text({
			label: "Coins: 0",
			color: "white",
			x: 0,
			y: 0
		}),statsContainer);

		var coins = stage.insert(new Q.UI.Text({ 
			label: "Seconds: 0",
			color: "white",
			x: 300,
			y: 0
		}),statsContainer);
	});

	//load assets
	Q.load("tiles_map.png, player.png, slime.png, fly.png, level1.tmx, coin.png", function() {            
		Q.sheet("tiles","tiles_map.png", { tilew: 70, tileh: 70});          
		Q.stageScene("level1");
		Q.stageScene("gameStats",1);
	});
	// END GAME CODE

});