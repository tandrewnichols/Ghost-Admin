import $ from 'jquery';
import Component from '@ember/component';
import EmberObject, {computed, set, setProperties} from '@ember/object';
import countWords, {stripTags} from '../utils/count-words';
import layout from '../templates/components/koenig-card-gallery';
import {
    IMAGE_EXTENSIONS,
    IMAGE_MIME_TYPES
} from 'ghost-admin/components/gh-image-uploader';
import {htmlSafe} from '@ember/string';
import {isEmpty} from '@ember/utils';
import {run} from '@ember/runloop';

const MAX_IMAGES = 9;
const MAX_PER_ROW = 3;

export default Component.extend({
    layout,

    // payload: {
    //     images: [
    //         {src: '', width: '', height: '', row: 0},
    //         {src: '', width: '', height: '', row: 0},
    //         {src: '', width: '', height: '', row: 1}
    //     ],
    //     caption: ''
    // }

    // <figure class="kg-width-wide kg-card-gallery">
    //     <div class="kg-gallery-container">
    //         <div class="kg-gallery-row">
    //             <img data-aspect="1.5003" />
    //             <img />
    //         </div>
    //         <div class="kg-gallery-row">
    //             <img />
    //         </div>
    //         <div class="kg-gallery-row">
    //             <img />
    //             <img />
    //             <img />
    //         </div>
    //     </div>
    //     <figcaption></figcaption>
    // </figure>

    // attrs
    files: null,
    images: null,
    payload: null,
    isSelected: false,
    isEditing: false,
    imageExtensions: IMAGE_EXTENSIONS,
    imageMimeTypes: IMAGE_MIME_TYPES,

    // properties
    handlesDragDrop: true,

    // closure actions
    selectCard() { },
    deselectCard() { },
    editCard() { },
    saveCard() { },
    deleteCard() { },
    moveCursorToNextSection() { },
    moveCursorToPrevSection() { },
    addParagraphAfterCard() { },
    registerComponent() { },

    counts: computed('payload.{caption,payload.images.[]}', function () {
        let wordCount = 0;
        let imageCount = this.payload.images.length;

        if (this.payload.src) {
            imageCount += 1;
        }

        if (this.payload.caption) {
            wordCount += countWords(stripTags(this.payload.caption));
        }

        return {wordCount, imageCount};
    }),

    toolbar: computed(function () {
        let items = [];

        items.push({
            title: 'Add images',
            icon: 'koenig/kg-replace',
            iconClass: 'fill-white',
            action: run.bind(this, this._triggerFileDialog)
        });

        if (items.length > 0) {
            return {items};
        }
    }),

    imageRows: computed('images.@each.{src,previewSrc,width,height}', function () {
        let rows = [];

        this.images.forEach((image, idx) => {
            if (!rows[image.row]) {
                rows[image.row] = [];
            }

            let styledImage = Object.assign({}, image);
            let aspectRatio = (image.width || 1) / (image.height || 1);
            styledImage.style = htmlSafe(`flex: ${aspectRatio} 1 0%`);

            let classes = [];
            if (image.row > 0) {
                classes.push('mt4');
            }
            if (idx % MAX_PER_ROW !== 0) {
                classes.push('ml4');
            }
            styledImage.classes = classes.join(' ');

            rows[image.row].push(styledImage);
        });

        return rows;
    }),

    init() {
        this._super(...arguments);

        if (!this.payload || isEmpty(this.payload.images)) {
            this._updatePayloadAttr('images', []);
        }

        this.images = this.payload.images.map(image => EmberObject.create(image));

        this.registerComponent(this);
    },

    didReceiveAttrs() {
        this._super(...arguments);
        console.log('didReceiveAttrs', this.payload);
    },

    actions: {
        insertImageIntoPayload(uploadResult) {
            let image = this.images.findBy('fileName', uploadResult.fileName);
            let idx = this.images.indexOf(image);

            image.set('src', uploadResult.url);

            this.payload.images.replace(idx, 1, [
                Object.assign({}, image, {previewSrc: undefined})
            ]);

            this._updatePayloadAttr('images', this.payload.images);
        },

        insertImagePreviews(files) {
            let count = this.images.length;
            let row = Math.ceil(count / MAX_PER_ROW) - 1;

            Array.from(files).forEach((file) => {
                count = count + 1;
                row = Math.ceil(count / MAX_PER_ROW) - 1;

                let image = EmberObject.create({
                    row,
                    fileName: file.name
                });

                this.images.pushObject(image);
                this.payload.images.push(Object.assign({}, image));

                let reader = new FileReader();

                reader.onload = (e) => {
                    let imageObject = new Image();
                    let previewSrc = htmlSafe(e.target.result);

                    if (!image.src) {
                        image.set('previewSrc', previewSrc);
                    }

                    imageObject.onload = () => {
                        image.set('width', imageObject.width);
                        image.set('height', imageObject.height);

                        if (this.payload.images.includes(image)) {
                            this._updatePayloadAttr('images', this.payload.images);
                        }
                    };

                    imageObject.src = previewSrc;
                };

                reader.readAsDataURL(file);
            });
        },

        updateCaption(caption) {
            this._updatePayloadAttr('caption', caption);
        },

        /**
         * Opens a file selection dialog - Triggered by "Upload Image" buttons,
         * searches for the hidden file input within the .gh-setting element
         * containing the clicked button then simulates a click
         * @param  {MouseEvent} event - MouseEvent fired by the button click
         */
        triggerFileDialog(event) {
            this._triggerFileDialog(event);
        },

        uploadFailed(uploadResult) {
            // uploadResult.fileName
            // uploadResult.message
            console.log('uploadFailed', uploadResult);
        }
    },

    dragOver(event) {
        if (!event.dataTransfer) {
            return;
        }

        // this is needed to work around inconsistencies with dropping files
        // from Chrome's downloads bar
        if (navigator.userAgent.indexOf('Chrome') > -1) {
            let eA = event.dataTransfer.effectAllowed;
            event.dataTransfer.dropEffect = (eA === 'move' || eA === 'linkMove') ? 'move' : 'copy';
        }

        event.stopPropagation();
        event.preventDefault();

        this.set('isDraggedOver', true);
    },

    dragLeave(event) {
        event.preventDefault();
        this.set('isDraggedOver', false);
    },

    drop(event) {
        event.preventDefault();
        this.set('isDraggedOver', false);

        if (event.dataTransfer.files) {
            this.set('files', event.dataTransfer.files);
        }
    },

    _updatePayloadAttr(attr, value) {
        let payload = this.payload;
        let save = this.saveCard;

        set(payload, attr, value);

        // update the mobiledoc and stay in edit mode
        save(payload, false);
    },

    _triggerFileDialog(event) {
        let target = event && event.target || this.element;

        // simulate click to open file dialog
        // using jQuery because IE11 doesn't support MouseEvent
        $(target)
            .closest('.__mobiledoc-card')
            .find('input[type="file"]')
            .click();
    }
});
