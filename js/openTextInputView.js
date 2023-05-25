/*
 * adapt-contrib-openTextInput
 * License - http://github.com/adaptlearning/adapt_framework/LICENSE
 * Maintainers
 * Brian Quinn <brian@learningpool.com>
 * Barry McKay <barry@learningpool.com>
 */

define([
  'core/js/adapt',
  'core/js/views/questionView',
  'core/js/enums/buttonStateEnum',
  'libraries/ckeditor'
], function(Adapt, QuestionView, BUTTON_STATE, ClassicEditor) {

  const HIDE_MODEL_ANSWER_CLASS = 'opentextinput__hide-modelanswer'
  const SHOW_MODEL_ANSWER_CLASS = 'opentextinput__show-modelanswer'

  class OpenTextInputView extends QuestionView {

    events() {
      return {
        'keyup .ck-editor__editable': 'onKeyUpTextarea'
      }
    }

    onKeyUpTextarea() {
      const countandLimitCharacters = _.throttle(() => {
        this.model.setUserAnswer(this.editor.getData());
      }, 300);
      countandLimitCharacters();
      this.model.checkCanSubmit();
    }

    setupQuestion() {
      this.listenTo(this.model, 'change:_isComplete', this.onCompleteChanged);
      const localUserAnswer = this.loadLocalAnswer();
      this.model.setupQuestion(localUserAnswer);
    }

    onCompleteChanged(isComplete, buttonState) {
 
      // disable the ck5 editor on complete
      this.editor.enableReadOnlyMode( 'my-feature-id' );


      // on complete change can be called when submitting a correct answer
      // we need to check if the textbox already has a value before
      // attempting to prepopulate the answer field with the model user answer
      if (this.$textbox.html() === '') {
        this.$textbox.html(this.model.getUserAnswer().replace(/\n/g, '<br>'));
      }

      if (!isComplete) return;

      if (!this.model.get('_canShowModelAnswer')) return;

      // Keep the action button enabled so we can show the model answer.
      Adapt.a11y.toggleAccessibleEnabled(this.$('.btn__action'), true);
      // Ensure count is not read out again
      // Adapt.a11y.toggleAccessible(this.$('.opentextinput__count-amount'), false);

      if (_.isEmpty(buttonState)) return;

      let _buttonState = BUTTON_STATE.HIDE_CORRECT_ANSWER;

      // Toggle the button.
      if (buttonState === BUTTON_STATE.CORRECT || buttonState === BUTTON_STATE.HIDE_CORRECT_ANSWER || buttonState === BUTTON_STATE.SUBMIT) {
        _buttonState = BUTTON_STATE.SHOW_CORRECT_ANSWER;
      }

      this.model.set('_buttonState', _buttonState);
    }

    isCorrect() {
      return this.model.isCorrect();
    }

    onQuestionRendered() {
      this.listenTo(this.buttonsView, 'buttons:stateUpdate', this.onActionClicked);

      this.$textbox = this.$('ck-editor__editable');
      this.$modelAnswer = this.$('.opentextinput__item-modelanswer');

      this.setReadyStatus();

      if (this.model.get('_isComplete') && !this.model.get('_canShowModelAnswer')) {
        // Model answer has been disabled.
        // Force setting the correct/submitted state.
        this.model.set('_buttonState', BUTTON_STATE.CORRECT);
      }

      if (!this.model.get('_isInteractionComplete')) return;
      // this.$textbox.prop('disabled', true);
    }

    loadLocalAnswer() {
      const identifier = this.model.get('_id') + '-OpenTextInput-UserAnswer';
      let userAnswer = false;

      if (this.supportsHtml5Storage() && !this.model.get('_isResetOnRevisit')) {
        userAnswer = localStorage.getItem(identifier);
      }

      return userAnswer;
    }

    supportsHtml5Storage() {
      // check for html5 local storage support
      try {
        return 'localStorage' in window && typeof window['localStorage'] !== 'undefined';
      } catch (e) {
        return false;
      }
    }

    limitCharacters() {
      const allowedCharacters = this.model.get('_allowedCharacters');
      if (allowedCharacters !== null && this.$textbox.val().length > allowedCharacters) {
        const substringValue = this.$textbox.val().substring(0, allowedCharacters);
        this.$textbox.val(substringValue);
      }
    }

    onSubmitted() {
      const userAnswer = this.editor.getData();
      this.model.setUserAnswer(userAnswer);
      this.storeUserAnswer();
    }

    storeUserAnswer() {
      // Use unique identifier to avoid collisions with other components
      const identifier = this.model.get('_id') + '-OpenTextInput-UserAnswer';

      if (this.supportsHtml5Storage() && !this.model.get('_isResetOnRevisit')) {
        // Adding a try-catch here as certain browsers, e.g. Safari on iOS in Private mode,
        // report as being able to support localStorage but fail when setItem() is called.
        try {
          localStorage.setItem(identifier, this.editor.getData());
        } catch (e) {
          console.log('ERROR: HTML5 localStorage.setItem() failed! Unable to save user answer.');
        }
      }

      this.model.set('_isSaved', true);
    }

    onActionClicked(buttonState) {
      // if (!this.model.get('_isComplete')) return;
      this.onCompleteChanged(true, buttonState);
    }

    postRender() {
      QuestionView.prototype.postRender.call(this);


      ClassicEditor.create ( document.querySelector( '#textbox__' + this.model.get('_id') ) )
      .then( editor => {
        this.editor = editor;
        const wordCountPlugin = editor.plugins.get( 'WordCount' );
        const wordCountWrapper = document.getElementById( 'word-count__' + this.model.get('_id'));

        wordCountWrapper.appendChild( wordCountPlugin.wordCountContainer );
      })
      .catch ( error => {
          console.error( error );
      } );

      if (this.$modelAnswer.height() <= 0) {
        this.$textbox.css('height', 'auto');
        this.$countChars.css('height', 'auto');
      } else {
        // Set the height of the textarea to the height of the model answer.
        // This creates a smoother user experience
        this.$textbox.height(this.$modelAnswer.height());
      }

      this.$modelAnswer.addClass(HIDE_MODEL_ANSWER_CLASS);
    }

    showCorrectAnswer() {
      this.model.set('_buttonState', BUTTON_STATE.HIDE_CORRECT_ANSWER);

      this.$textbox.hide();
      this.$countChars.hide();
      this.$modelAnswer.addClass(SHOW_MODEL_ANSWER_CLASS).removeClass(HIDE_MODEL_ANSWER_CLASS);

      // Give focus to Model Answer to be read by Screen Reader
      Adapt.a11y.focusFirst(this.$('.opentextinput__item-modelanswer'));
    }

    hideCorrectAnswer() {
      this.model.set('_buttonState', BUTTON_STATE.SHOW_CORRECT_ANSWER);

      this.$('textarea.opentextinput__item-textbox').show();
      this.$('.opentextinput__count-characters-container').show();
      this.$('.opentextinput__item-modelanswer')
        .addClass(HIDE_MODEL_ANSWER_CLASS)
        .removeClass(SHOW_MODEL_ANSWER_CLASS);
    }

    /**
     * Used by adapt-contrib-spoor to get the user's answers in the format required by the cmi.interactions.n.student_response data field
     */
    getResponse() {
      return this.model.getResponse();
    }

    /**
     * Used by adapt-contrib-spoor to get the type of this question in the format required by the cmi.interactions.n.type data field
     */
    getResponseType() {
      return this.model.getResponseType();
    }

    getInteractionObject() {
      return this.model.getInteractionObject();
    }

    /**
     * Used by questionView. Clears the models on Revisit userAnswer so input appears blank
     */
    resetQuestionOnRevisit() {
      this.resetQuestion();
    }

    /**
     * Used by questionView. Clears the models userAnswer onResetClicked so input appears blank
     */
    resetQuestion() {
      this.model.setUserAnswer('');
    }
  };

  return OpenTextInputView;

});
