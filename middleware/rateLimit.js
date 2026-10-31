import rateLimit from "express-rate-limit";
export const apiLimiter=rateLimit({windowMs:15*60*1000,limit:150,standardHeaders:"draft-7",legacyHeaders:false,message:{message:"Too many requests. Please try again later."}});
export const authLimiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:"draft-7",legacyHeaders:false,message:{message:"Too many authentication attempts. Try again later."}});
export const formLimiter=rateLimit({windowMs:60*60*1000,limit:5,standardHeaders:"draft-7",legacyHeaders:false,message:{message:"Too many submissions. Please try again later."}});
