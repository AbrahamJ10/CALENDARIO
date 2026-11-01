import { requireOptionalNativeModule } from 'expo';

// Solo existe en el APK de Android; en Expo Go o iOS es null
export default requireOptionalNativeModule('AgendaAlarm');
