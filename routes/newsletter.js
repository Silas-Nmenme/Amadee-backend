import {Router} from "express";
import {z} from "zod";
import {validate} from "../middleware/validate.js";
import {formLimiter} from "../middleware/rateLimit.js";
import {sendMail} from "../services/mailer.js";
const router=Router();const schema=z.object({email:z.string().email().max(254),website:z.string().optional().default("")});const subscribers=new Set();
router.post("/",formLimiter,validate(schema),async(req,res,next)=>{try{const {email,website}=req.validatedBody;if(website)return res.json({message:"Subscription received."});const key=email.toLowerCase();if(subscribers.has(key))return res.json({message:"You are already subscribed."});subscribers.add(key);if(process.env.SHOP_OWNER_EMAIL)await sendMail({to:process.env.SHOP_OWNER_EMAIL,subject:"New Amadee-Stiches newsletter subscriber",text:`Subscriber: ${key}`});res.status(201).json({message:"Subscribed."})}catch(e){next(e)}});
export default router;
