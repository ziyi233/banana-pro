import { Context, icons } from '@koishijs/client'
import Page from './pages/index.vue'
import BananaIcon from './icons/banana.vue'
import './styles/theme.css'

// 注册自定义香蕉图标
icons.register('banana', BananaIcon)

export default (ctx: Context) => {
    ctx.page({
        // 浣跨敤闆跺绌烘牸闅愯棌 Koishi 椤堕儴鏍囬鏂囨湰锛屼繚鐣欒嚜瀹氫箟 BANANA PRO 瀵艰埅
        name: 'BANANA PRO',
        path: '/banana-pro',
        component: Page,
        icon: 'banana',
        order: 500,
    })
}
