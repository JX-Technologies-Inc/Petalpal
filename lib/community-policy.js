import { assertContentAllowed } from './content-safety.js';
import { SocialAccessError } from './garden-access.js';
export const COMMUNITY_VERSION = 'petalpal-community-2026-10-15';
export function assertSocialContent(text) {
  assertContentAllowed(text);
  // Independently authored social-only rules. No third-party dictionary.
  const normalized = text.normalize('NFKC').normalize('NFD').replace(/[\p{M}\p{Cf}]/gu,'').toLowerCase();
  if (/(?:\b(?:send (?:me )?nudes|child porn|rape you|buy cocaine)\b|儿童色情|强奸你)/u.test(normalized)) {
    throw Object.assign(new Error('Please revise this social content to follow the Community Guidelines.'),{status:422,code:'CONTENT_REJECTED'});
  }
}
export async function requireCommunityAcceptance(db, userId) {
  const user = await db.user.findUnique({where:{id:userId},select:{communityTermsVersion:true,socialRestricted:true}});
  if (user?.socialRestricted) throw new SocialAccessError('Social publication is unavailable',403);
  if (user?.communityTermsVersion !== COMMUNITY_VERSION) throw Object.assign(new SocialAccessError('Read and accept the Community Guidelines before publishing.',428),{code:'COMMUNITY_ACCEPTANCE_REQUIRED'});
}
export function installCommunityPolicy(app, db) {
  app.get('/users/me/community-acceptance', async(req,res)=>{
    const user=await db.user.findUnique({where:{id:req.auth.userId},select:{communityTermsVersion:true}});
    res.json({version:COMMUNITY_VERSION,accepted:user?.communityTermsVersion===COMMUNITY_VERSION});
  });
  app.put('/users/me/community-acceptance',async(req,res)=>{
    if(req.body.version!==COMMUNITY_VERSION || req.body.accepted!==true || Object.keys(req.body).some(k=>!['version','accepted'].includes(k))) return res.status(400).json({error:'Explicit acceptance of the current Community Guidelines is required'});
    await db.user.update({where:{id:req.auth.userId},data:{communityTermsVersion:COMMUNITY_VERSION,communityAcceptedAt:new Date()}});
    res.json({version:COMMUNITY_VERSION,accepted:true});
  });
}
