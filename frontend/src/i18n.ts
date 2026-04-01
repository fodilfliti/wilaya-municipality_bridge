import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  ar: {
    translation: {
      appTitle: 'بوابة الولاية - البلدية',
      langArabic: 'العربية',
      langFrench: 'Français',
      login: 'تسجيل الدخول',
      username: 'اسم المستخدم',
      password: 'الرمز (8 أرقام)',
      signIn: 'دخول',
      logout: 'خروج',
      roleAdmin: 'مسؤول الولاية',
      roleMuni: 'مسؤول البلدية',
      apps: 'التطبيقات',
      latest: 'آخر إصدار',
      download: 'تحميل',
      adminDashboard: 'لوحة المتابعة',
      appManagement: 'إدارة التطبيقات',
      progress: 'حالة التحديث حسب البلدية',
      upToDate: 'محدّث',
      outdated: 'غير محدّث',
      neverDownloaded: 'لم يتم التحميل',
      noVersions: 'لا توجد إصدارات',
      downgrade: 'تخفيض الإصدار',
      downgradeDetectedNote: 'ملاحظة: تم رصد تخفيض الإصدار (تنزيل نسخة أقدم).',
      createMunicipality: 'إضافة بلدية',
      municipalityCode: 'رمز البلدية',
      municipalityNameAr: 'اسم البلدية (عربي)',
      municipalityNameFr: 'اسم البلدية (فرنسي)',
      save: 'حفظ',
      createMuniUser: 'إنشاء حساب بلدية',
      optionalUsername: 'اسم مستخدم (اختياري)',
      generatedPdf: 'ملف PDF للمعلومات',
      close: 'إغلاق',
      uploadLogo: 'رفع شعار التطبيق',
      uploadVersion: 'رفع إصدار جديد',
      versionNumber: 'رقم الإصدار (مثال: v1.2.0)',
      releaseNotes: 'ملاحظات الإصدار (اختياري)',
      chooseFile: 'اختر ملفاً',
      submit: 'إرسال',
      pdfReport: 'تقرير PDF'
    }
  },
  fr: {
    translation: {
      appTitle: 'Portail Wilaya - Commune',
      langArabic: 'العربية',
      langFrench: 'Français',
      login: 'Connexion',
      username: "Nom d'utilisateur",
      password: 'Code (8 chiffres)',
      signIn: 'Se connecter',
      logout: 'Déconnexion',
      roleAdmin: 'Admin Wilaya',
      roleMuni: 'Admin Commune',
      apps: 'Applications',
      latest: 'Dernière version',
      download: 'Télécharger',
      adminDashboard: 'Tableau de suivi',
      appManagement: 'Gestion des applications',
      progress: 'Statut par commune',
      upToDate: 'À jour',
      outdated: 'En retard',
      neverDownloaded: 'Jamais téléchargé',
      noVersions: 'Aucune version',
      downgrade: 'Rétrogradation',
      downgradeDetectedNote: 'Note : une rétrogradation a été détectée (téléchargement d’une version plus ancienne).',
      createMunicipality: 'Ajouter une commune',
      municipalityCode: 'Code commune',
      municipalityNameAr: 'Nom (arabe)',
      municipalityNameFr: 'Nom (français)',
      save: 'Enregistrer',
      createMuniUser: 'Créer compte commune',
      optionalUsername: "Nom d'utilisateur (optionnel)",
      generatedPdf: "PDF d'identifiants",
      close: 'Fermer',
      uploadLogo: "Téléverser le logo",
      uploadVersion: 'Téléverser une version',
      versionNumber: 'Numéro de version (ex: v1.2.0)',
      releaseNotes: 'Notes de version (optionnel)',
      chooseFile: 'Choisir un fichier',
      submit: 'Envoyer',
      pdfReport: 'Rapport PDF'
    }
  }
} as const

i18n.use(initReactI18next).init({
  resources,
  lng: 'ar',
  fallbackLng: 'ar',
  interpolation: { escapeValue: false }
})

export default i18n

