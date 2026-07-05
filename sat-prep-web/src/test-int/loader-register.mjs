/* Đăng ký resolve hook (loader.mjs) qua module.register — dùng với node --import. */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./loader.mjs', pathToFileURL(import.meta.dirname + '/'));
