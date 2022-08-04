import { PI, INVALID_ID, DONE, posInRect, isDone } from './utils.js';
import DetailCover from './detailCover.js';
import Curtain from './curtain.js';
import CircleProgressBar from './circleProgressBar.js';

export default class RotaryCover {
  static DEGREE_INTERVAL = 10;
  static TURN_LEFT = -1;
  static TURN_RIGHT = 1;
  static INIT_ROTARY_SPEED = 1;
  static CLICK_FIELD_SIZE = 100;
  static CLICK_FIELD_HALF_SIZE = RotaryCover.CLICK_FIELD_SIZE / 2;
  static INIT_RATIO = 1;
  static SELECTED_MODE_RATIO = 1.1;
  static DETAIL_MODE_RATIO = 2;
  static BUTTON_APPEAR_DURATION = 800;

  #canvas;
  #ctx;
  #pixelRatio;
  #detailCover;
  #backgroundCurtain;
  #progressBar = null;
  #stageWidth;
  #stageHeight;
  #rotationRadius;
  #rotationAxis;
  #covers = [];
  #currentDegree = 0;
  #targetDegree = this.#currentDegree;
  #rotaryDirection = 0;
  #rotarySpeed = RotaryCover.INIT_ROTARY_SPEED;
  #prevSelectedIndex;
  #clickFields = [];
  #prevRotaryState = false;
  #body;

  #leftButtons;
  #bottomButtons;
  #returnBtn;
  #fullscreenBtn;
  #toBeOpenedCurtain = false;
  #toBeClosedCurtain = false;

  #prevProgressStatus = DONE;
  #progressTimeoutID = INVALID_ID;
  #progressCanceled = false;
  #isCoverDisappeared = false;

  constructor(covers) {
    this.#leftButtons = document.querySelector('.left-buttons');
    this.#bottomButtons = document.querySelector('.bottom-buttons');
    this.#returnBtn = document.querySelector('.return');
    this.#fullscreenBtn = document.querySelector('.fullscreen');
    this.#body = document.querySelector('body');

    this.#canvas = document.createElement('canvas');
    this.#ctx = this.#canvas.getContext('2d');
    document.body.append(this.#canvas);
    this.#pixelRatio = window.devicePixelRatio > 1 ? 2 : 1;

    this.#backgroundCurtain = new Curtain();
    this.#detailCover = new DetailCover();
    this.#initProgressBar('rgb(200, 200, 200)', '#6d6d6d', 3);

    window.addEventListener('resize', this.resize);
    window.addEventListener('click', this.#moveToSelectedCover); // prettier-ignore
    window.addEventListener('mousemove', this.#changeCursorShape);
    this.#fullscreenBtn.addEventListener('click', this.#setFullscreenMode); // prettier-ignore
    this.#returnBtn.addEventListener('click', this.#setSelectMode);

    this.#onWebFontLoad(covers);

    window.requestAnimationFrame(this.animate);
  }

  resize = () => {
    this.#stageWidth = document.body.clientWidth;
    this.#stageHeight = document.body.clientHeight;

    this.#canvas.width = this.#stageWidth * this.#pixelRatio;
    this.#canvas.height = this.#stageHeight * this.#pixelRatio;

    this.#rotationRadius = this.#stageHeight;
    this.#rotationAxis = {
      x: this.#stageWidth / 2,
      y: (this.#stageHeight / 2) * 3,
    };

    this.#setSelectMode(true);

    this.#backgroundCurtain.resize(this.#stageWidth, this.#stageHeight);
    this.#detailCover.resize(this.#stageWidth, this.#stageHeight);
    this.#initProgressBar('rgb(200, 200, 200)', '#6d6d6d', 3);
    this.#drawCoverItems();
    this.#setTargetPosAndRatio(
      RotaryCover.INIT_RATIO,
      RotaryCover.SELECTED_MODE_RATIO
    );
  };

  #initProgressBar(colorBackground, colorProgressBar, targetTime) {
    if (this.#progressBar) {
      this.#progressBar.clear();
      this.#progressBar = null;
    }

    const rect = this.#returnBtn.getBoundingClientRect();
    const padding = 10;

    this.#progressBar = new CircleProgressBar(
      rect.width + padding * 2,
      { background: colorBackground, progressBar: colorProgressBar },
      targetTime
    );

    this.#progressBar.setPosition(
      rect.x - rect.width * 2 - padding,
      rect.y - padding
    );
  }

  #setFullscreenMode = () => {
    window.removeEventListener('click', this.#moveToSelectedCover);
    window.removeEventListener('mousemove', this.#changeCursorShape);
    this.#bottomButtons.style.display = 'none';
    this.#toBeOpenedCurtain = true;
  };

  #setSelectMode = (toBeDirect = false) => {
    this.#isCoverDisappeared = isDone(this.#prevProgressStatus);

    if (this.#progressTimeoutID !== INVALID_ID) {
      this.#killProgressTimer();
      this.#isCoverDisappeared = false;
    }

    this.#progressBar.stop();
    this.#progressBar.clear();
    this.#progressCanceled = true;

    this.#leftButtons.classList.remove('left-button-on');
    this.#returnBtn.classList.remove('right-button-on');
    this.#setCloseCurtainTimer(toBeDirect);
  };

  #setCloseCurtainTimer(toBeDirect) {
    toBeDirect ? (this.#toBeClosedCurtain = true)
               : setTimeout(() => (this.#toBeClosedCurtain = true), RotaryCover.BUTTON_APPEAR_DURATION); // prettier-ignore
  }

  #onWebFontLoad = (covers) => {
    WebFont.load({
      google: {
        families: ['Abril Fatface'],
      },
      fontactive: () => {
        this.#onInit(covers);
      },
    });
  };

  #onInit = (covers) => {
    this.#covers = covers;

    const coverCount = this.#covers.length;
    this.#prevSelectedIndex = Math.floor(coverCount / 2);
    this.#currentDegree = this.#prevSelectedIndex * RotaryCover.DEGREE_INTERVAL;

    this.resize();
  };

  #moveToSelectedCover = (clickEvent) => {
    this.#onMouseInClickField(clickEvent, this.#setTarget);
  };

  #changeCursorShape = (mousemoveEvent) => {
    if (this.#body.style.cursor === 'pointer') {
      this.#body.style.cursor = 'default';
    }

    this.#onMouseInClickField(mousemoveEvent, () => (this.#body.style.cursor = 'pointer')); // prettier-ignore
  };

  #onMouseInClickField = (event, handler) => {
    const pos = { x: event.clientX, y: event.clientY };

    this.#clickFields.forEach((rect, index) => {
      if (posInRect(pos, rect)) {
        handler(index);
        return;
      }
    });
  };

  #setTarget = (index) => {
    this.#rotarySpeed = RotaryCover.INIT_ROTARY_SPEED;
    this.#rotaryDirection = this.#prevSelectedIndex > index ? RotaryCover.TURN_LEFT
                                                            : RotaryCover.TURN_RIGHT; // prettier-ignore
    this.#targetDegree = index * RotaryCover.DEGREE_INTERVAL;
    this.#prevSelectedIndex = index;
  };

  #drawCoverItems() {
    this.#clickFields = [];
    this.#currentDegree =
      (this.#currentDegree + this.#rotarySpeed * this.#rotaryDirection) % 361;

    this.#covers.forEach((cover, index) => {
      const degree = RotaryCover.DEGREE_INTERVAL * index - this.#currentDegree;
      const radian = (degree * PI) / 180;

      const rotationPos = {
        x: this.#rotationAxis.x + this.#rotationRadius * Math.sin(radian),
        y: this.#rotationAxis.y - this.#rotationRadius * Math.cos(radian)  
      } // prettier-ignore

      this.#drawCover(cover, rotationPos, radian);
      this.#drawTitle(cover, rotationPos, radian);
      this.#initClickFields(rotationPos);
    });
  }

  #initClickFields(rotationPos) {
    this.#clickFields.push({
      x: rotationPos.x - RotaryCover.CLICK_FIELD_HALF_SIZE,
      y: rotationPos.y - RotaryCover.CLICK_FIELD_HALF_SIZE,
      w: RotaryCover.CLICK_FIELD_SIZE,
      h: RotaryCover.CLICK_FIELD_SIZE,
    });
  }

  #drawCover(cover, rotationPos, radian) {
    this.#ctx.save();

    this.#ctx.translate(rotationPos.x, rotationPos.y);
    this.#ctx.rotate(radian);
    cover.animate(this.#ctx);

    this.#ctx.restore();
  }

  #drawTitle(cover, rotationPos, radian) {
    this.#ctx.save();

    const textRadian = (270 * PI) / 180;
    this.#ctx.translate(rotationPos.x, rotationPos.y);
    this.#ctx.rotate(radian + textRadian);

    // TODO:: use static variable!
    this.#ctx.font = '10 20px Arial';
    this.#ctx.textAlign = 'left';
    this.#ctx.fillStyle = '#BEBCBE';
    this.#ctx.fillText(cover.title, 200, 0);

    this.#ctx.fillStyle = '#D0CED0';
    // TODO:: day should be a variable in the class PortpolioCover
    this.#ctx.fillText(`${cover.createdDate.month}, 11`, 200, 20);

    this.#ctx.restore();
  }

  animate = (curTime) => {
    this.#isRotating() ? this.#onRotation() : this.#onNotRotation();

    this.#toBeOpenedCurtain && this.#onOpenCurtain();
    this.#toBeClosedCurtain && this.#onCloseCurtain();

    this.#detailCover.animate();
    this.#onProgressFinished(this.#progressBar.animate(curTime));

    window.requestAnimationFrame(this.animate);
  };

  #isRotating() {
    return (
      (this.#rotaryDirection == RotaryCover.TURN_RIGHT && this.#currentDegree <= this.#targetDegree) ||
      (this.#rotaryDirection == RotaryCover.TURN_LEFT && this.#currentDegree >= this.#targetDegree)
    ); // prettier-ignore
  }

  #onRotation() {
    this.#ctx.clearRect(0, 0, this.#stageWidth, this.#stageHeight);
    this.#drawCoverItems();

    if (!this.#prevRotaryState) {
      this.#detailCover.clear();
      this.#prevRotaryState = true;
    }
  }

  #onNotRotation() {
    if (this.#prevRotaryState) {
      this.#setTargetPosAndRatio(
        RotaryCover.INIT_RATIO,
        RotaryCover.SELECTED_MODE_RATIO
      );
      this.#prevRotaryState = false;
    }
  }

  #onOpenCurtain() {
    if (this.#backgroundCurtain.on()) {
      this.#toBeOpenedCurtain = false;
      this.#setTargetPosAndRatio(RotaryCover.SELECTED_MODE_RATIO, RotaryCover.DETAIL_MODE_RATIO); // prettier-ignore

      this.#setShowButtonTimer();
    }
  }

  #setShowButtonTimer() {
    setTimeout(() => {
      this.#leftButtons.classList.add('left-button-on');
      this.#returnBtn.classList.add('right-button-on');

      this.#setProgressTimer();
    }, RotaryCover.BUTTON_APPEAR_DURATION);
  }

  #setProgressTimer() {
    this.#progressTimeoutID = setTimeout(() => {
      this.#progressBar.start();
      this.#progressTimeoutID = INVALID_ID;
    }, RotaryCover.BUTTON_APPEAR_DURATION);
  }

  #killProgressTimer() {
    clearTimeout(this.#progressTimeoutID);
    this.#progressTimeoutID = INVALID_ID;
  }

  #onCloseCurtain() {
    if (this.#backgroundCurtain.off()) {
      this.#progressCanceled = false;
      this.#toBeClosedCurtain = false;
      this.#bottomButtons.style.display = 'flex';

      window.addEventListener('click', this.#moveToSelectedCover);
      window.addEventListener('mousemove', this.#changeCursorShape);

      this.#isCoverDisappeared ? this.#setTargetPosAndRatio(RotaryCover.INIT_RATIO, RotaryCover.SELECTED_MODE_RATIO)
                               : this.#detailCover.setTargetRatio(RotaryCover.DETAIL_MODE_RATIO,RotaryCover.SELECTED_MODE_RATIO); // prettier-ignore
    }
  }

  #setTargetPosAndRatio(startRatio, targetRatio) {
    const degree =
      RotaryCover.DEGREE_INTERVAL * this.#prevSelectedIndex -
      this.#currentDegree;
    const radian = (degree * PI) / 180;

    const rotationPos = {
      x: this.#rotationAxis.x + this.#rotationRadius * Math.sin(radian),
      y: this.#rotationAxis.y - this.#rotationRadius * Math.cos(radian)  
    } // prettier-ignore

    const cover = this.#covers[this.#prevSelectedIndex];

    this.#detailCover.init(cover, rotationPos);
    this.#detailCover.setTargetRatio(startRatio, targetRatio);
  }

  #onProgressFinished(curStatus) {
    if (!isDone(this.#prevProgressStatus) && isDone(curStatus)) {
      this.#progressBar.clear();
      this.#progressCanceled || this.#detailCover.disappearToLeft();
    }

    this.#prevProgressStatus = curStatus;
  }
}
