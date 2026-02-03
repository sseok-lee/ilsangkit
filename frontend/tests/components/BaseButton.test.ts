import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BaseButton from '~/components/common/BaseButton.vue'

describe('BaseButton', () => {
  describe('Rendering', () => {
    it('should render with default slot content', () => {
      const wrapper = mount(BaseButton, {
        slots: {
          default: 'Click me',
        },
      })

      expect(wrapper.text()).toBe('Click me')
    })

    it('should render as button element by default', () => {
      const wrapper = mount(BaseButton)
      expect(wrapper.element.tagName).toBe('BUTTON')
    })
  })

  describe('Variants', () => {
    it('should apply primary variant styles', () => {
      const wrapper = mount(BaseButton, {
        props: { variant: 'primary' },
      })

      expect(wrapper.classes()).toContain('bg-primary-600')
    })

    it('should apply secondary variant styles', () => {
      const wrapper = mount(BaseButton, {
        props: { variant: 'secondary' },
      })

      expect(wrapper.classes()).toContain('bg-gray-600')
    })

    it('should apply outline variant styles', () => {
      const wrapper = mount(BaseButton, {
        props: { variant: 'outline' },
      })

      expect(wrapper.classes()).toContain('border-2')
      expect(wrapper.classes()).toContain('bg-transparent')
    })
  })

  describe('Sizes', () => {
    it('should apply small size styles', () => {
      const wrapper = mount(BaseButton, {
        props: { size: 'sm' },
      })

      expect(wrapper.classes()).toContain('text-sm')
      expect(wrapper.classes()).toContain('px-3')
      expect(wrapper.classes()).toContain('py-2')
    })

    it('should apply medium size styles (default)', () => {
      const wrapper = mount(BaseButton, {
        props: { size: 'md' },
      })

      expect(wrapper.classes()).toContain('text-base')
      expect(wrapper.classes()).toContain('px-4')
      expect(wrapper.classes()).toContain('py-2.5')
    })

    it('should apply large size styles', () => {
      const wrapper = mount(BaseButton, {
        props: { size: 'lg' },
      })

      expect(wrapper.classes()).toContain('text-lg')
      expect(wrapper.classes()).toContain('px-6')
      expect(wrapper.classes()).toContain('py-3')
    })
  })

  describe('Touch Target (Accessibility)', () => {
    it('should have minimum 44x44px touch target for small size', () => {
      const wrapper = mount(BaseButton, {
        props: { size: 'sm' },
      })

      // Small button should have min-h-11 (44px) and min-w-11 (44px)
      expect(wrapper.classes()).toContain('min-h-11')
      expect(wrapper.classes()).toContain('min-w-11')
    })

    it('should have minimum 44x44px touch target for medium size', () => {
      const wrapper = mount(BaseButton, {
        props: { size: 'md' },
      })

      expect(wrapper.classes()).toContain('min-h-11')
      expect(wrapper.classes()).toContain('min-w-11')
    })

    it('should have minimum 44x44px touch target for large size', () => {
      const wrapper = mount(BaseButton, {
        props: { size: 'lg' },
      })

      expect(wrapper.classes()).toContain('min-h-11')
      expect(wrapper.classes()).toContain('min-w-11')
    })
  })

  describe('Disabled State', () => {
    it('should apply disabled styles when disabled prop is true', () => {
      const wrapper = mount(BaseButton, {
        props: { disabled: true },
      })

      expect(wrapper.attributes('disabled')).toBeDefined()
      expect(wrapper.classes()).toContain('opacity-50')
      expect(wrapper.classes()).toContain('cursor-not-allowed')
    })

    it('should not be disabled by default', () => {
      const wrapper = mount(BaseButton)
      expect(wrapper.attributes('disabled')).toBeUndefined()
    })
  })

  describe('Events', () => {
    it('should emit click event when clicked', async () => {
      const wrapper = mount(BaseButton)

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeTruthy()
      expect(wrapper.emitted('click')).toHaveLength(1)
    })

    it('should not emit click event when disabled', async () => {
      const wrapper = mount(BaseButton, {
        props: { disabled: true },
      })

      await wrapper.trigger('click')

      expect(wrapper.emitted('click')).toBeFalsy()
    })
  })
})
